// Rapid response (Workforce board): when a WARN notice hits an employer in the
// college's region, the college and the board offer affected workers, alumni
// or not, a seat in a WIOA-eligible program. The offer has a public sign-up
// page; a sign-up becomes an application (payer WIOA voucher, pending the
// board's eligibility check). Existing roster emails are reused; anyone else
// is added as a program learner, never as an alum.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { readProfile } from './profile'
import { openCohorts } from './programs'

const DAY = 86_400_000

// Recent WARN filings in the college's region (its counties, else its state).
export async function regionNotices(institutionId: string, now = new Date()) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { profile: true } })
  const region = readProfile(inst.profile).region
  if (!region?.state) return []
  const counties = (region.counties ?? []).map((c) => c.toLowerCase())
  const notices = await prisma.warnNotice.findMany({
    where: { state: region.state, dismissedAt: null, noticeDate: { gte: new Date(now.getTime() - 120 * DAY) } },
    orderBy: { noticeDate: 'desc' },
    take: 60,
    select: { id: true, employer: true, county: true, noticeDate: true, effectiveDate: true, employees: true, sourceUrl: true, rapidResponses: { where: { institutionId }, select: { id: true } } },
  })
  const local = counties.length ? notices.filter((n) => n.county && counties.some((c) => n.county!.toLowerCase().includes(c))) : notices
  // Fall back to the whole state when nothing is filed in the counties.
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
    select: { id: true, institutionId: true, employerName: true, title: true, message: true, programIds: true },
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
