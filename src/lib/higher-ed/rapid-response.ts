// Rapid response (Workforce board): when a WARN notice hits an employer in the
// college's region, the college and the board offer affected workers, alumni
// or not, a seat in a WIOA-eligible program. The offer has a public sign-up
// page; a sign-up becomes an application (payer WIOA voucher, pending the
// board's eligibility check). Existing roster emails are reused; anyone else
// is added as a program learner, never as an alum.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { readProfile, regionAreas } from './profile'
import { openCohorts } from './programs'

const DAY = 86_400_000

// Recent WARN filings in the college's region (its counties, else its state).
export async function regionNotices(institutionId: string, now = new Date()) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { profile: true } })
  const areas = regionAreas(readProfile(inst.profile).region)
  if (!areas.length) return []
  const notices = await prisma.warnNotice.findMany({
    where: { state: { in: areas.map((a) => a.state) }, dismissedAt: null, noticeDate: { gte: new Date(now.getTime() - 120 * DAY) } },
    orderBy: { noticeDate: 'desc' },
    take: 60,
    select: { id: true, employer: true, state: true, county: true, noticeDate: true, effectiveDate: true, employees: true, sourceUrl: true, rapidResponses: { where: { institutionId }, select: { id: true } } },
  })
  const inArea = (n: { state: string | null; county: string | null }) => {
    const a = areas.find((x) => x.state === n.state)
    return !!a && (!a.counties.length || (!!n.county && a.counties.some((c) => n.county!.toLowerCase().includes(c))))
  }
  const local = notices.filter(inArea)
  // Fall back to the whole states when nothing is filed in the counties.
  return (local.length ? local : notices).slice(0, 25).map(({ rapidResponses, ...n }) => ({ ...n, responseId: rapidResponses[0]?.id ?? null, inRegion: local.length > 0 }))
}

export async function createRapidResponse(args: { institutionId: string; warnNoticeId: string | null; employerName: string; title: string; message: string; programIds: string[]; createdBy: string }) {
  const programs = await prisma.program.findMany({ where: { id: { in: args.programIds }, institutionId: args.institutionId, isActive: true }, select: { id: true } })
  if (!programs.length) return { error: 'Pick at least one open program.' }
  const r = await prisma.rapidResponse.create({
    data: { institutionId: args.institutionId, warnNoticeId: args.warnNoticeId, employerName: args.employerName, title: args.title, message: args.message, programIds: programs.map((p) => p.id), createdBy: args.createdBy },
    select: { id: true },
  })
  return { id: r.id }
}

export async function listRapidResponses(institutionId: string) {
  return prisma.rapidResponse.findMany({
    where: { institutionId },
    orderBy: { createdAt: 'desc' },
    include: { enrollments: { select: { status: true } } },
  })
}

export async function setRapidResponseActive(institutionId: string, id: string, isActive: boolean) {
  return (await prisma.rapidResponse.updateMany({ where: { id, institutionId }, data: { isActive } })).count > 0
}

// The public page: the offer and the open cohorts of its programs.
export async function publicRapidResponse(slug: string, id: string) {
  const r = await prisma.rapidResponse.findFirst({
    where: { id, isActive: true, institution: { slug } },
    select: { id: true, institutionId: true, employerName: true, title: true, message: true, programIds: true, seats: true, memberCompanyId: true, _count: { select: { participants: true } } },
  })
  if (!r) return null
  const cohorts = (await openCohorts(r.institutionId)).filter((c) => r.programIds.includes(c.programId))
  return { ...r, cohorts }
}

export async function signUpForRapidResponse(args: { slug: string; id: string; cohortId: string; firstName: string; lastName: string; email: string; note: string }) {
  const r = await publicRapidResponse(args.slug, args.id)
  if (!r) return { error: 'This offer has closed.' }
  if (!r.cohorts.some((c) => c.id === args.cohortId)) return { error: 'That program is full or closed. Pick another.' }
  const email = args.email.trim().toLowerCase()
  const member =
    (await prisma.institutionMember.findFirst({ where: { institutionId: r.institutionId, email }, select: { id: true } })) ??
    (await prisma.institutionMember.create({
      data: { institutionId: r.institutionId, email, firstName: args.firstName || null, lastName: args.lastName || null, affiliation: 'LEARNER', matchMethod: 'MANUAL', lastKnownEmployer: r.employerName },
      select: { id: true },
    }))
  const existing = await prisma.enrollment.findUnique({ where: { cohortId_memberId: { cohortId: args.cohortId, memberId: member.id } }, select: { id: true } })
  if (existing) return { ok: true, already: true }
  await prisma.enrollment.create({
    data: {
      cohortId: args.cohortId,
      memberId: member.id,
      payer: 'WIOA_VOUCHER',
      rapidResponseId: r.id,
      note: [`Rapid response: ${r.employerName}.`, args.note.trim().slice(0, 500)].filter(Boolean).join(' '),
    },
  })
  return { ok: true, already: false }
}

// A workforce org's layoff seats: sign up with a name and email, take one
// seat, then join NextChapter with that email. Someone already on the roster
// keeps their row; a new person is a PARTICIPANT, tied to the company.
export async function signUpForSeat(args: { slug: string; id: string; firstName: string; lastName: string; email: string }) {
  const r = await publicRapidResponse(args.slug, args.id)
  if (!r || !r.seats) return { error: 'Sign-ups for this offer have closed.' }
  const email = args.email.trim().toLowerCase()
  const existing = await prisma.institutionMember.findFirst({ where: { institutionId: r.institutionId, email }, select: { id: true, rapidResponseId: true } })
  if (existing?.rapidResponseId === r.id) return { ok: true, already: true }
  if (r._count.participants >= r.seats) return { error: 'All the seats for this offer are taken. Contact your local career center for other options.' }
  const now = new Date()
  if (existing) {
    await prisma.institutionMember.update({ where: { id: existing.id }, data: { rapidResponseId: r.id, memberCompanyId: r.memberCompanyId, isActiveSeat: true, seatActivatedAt: now } })
  } else {
    await prisma.institutionMember.create({
      data: {
        institutionId: r.institutionId,
        email,
        firstName: args.firstName || null,
        lastName: args.lastName || null,
        affiliation: 'PARTICIPANT',
        matchMethod: 'MANUAL',
        lastKnownEmployer: r.employerName,
        memberCompanyId: r.memberCompanyId,
        rapidResponseId: r.id,
        isActiveSeat: true,
        seatActivatedAt: now,
      },
    })
  }
  return { ok: true, already: false }
}
