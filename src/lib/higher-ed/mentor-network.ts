// The alumni mentor network beyond the in-app directory (mentors.ts, the
// Candidate › Mentors tab): Alumni Relations invites alumni to mentor by
// email, an alum says yes from that email without signing in, and "N alumni
// work here" counts for jobs and employer pages.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { sendCampaign } from './outreach'

const DAY = 86_400_000

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export const MENTOR_INDUSTRIES = [
  'Finance',
  'Healthcare',
  'Law',
  'Technology',
  'Consulting',
  'Education',
  'Government and nonprofit',
  'Manufacturing and energy',
  'Media and marketing',
  'Real estate',
  'Sales',
  'Science and research',
] as const

export async function setMentorProfile(args: { institutionId: string; memberId: string; isActive: boolean; industries: string[]; maxCallsPerMonth: number }) {
  const industries = args.industries.filter((i) => (MENTOR_INDUSTRIES as readonly string[]).includes(i))
  const maxCallsPerMonth = Math.min(Math.max(Math.round(args.maxCallsPerMonth) || 2, 1), 8)
  return prisma.institutionMentor.upsert({
    where: { memberId: args.memberId },
    create: { institutionId: args.institutionId, memberId: args.memberId, isActive: args.isActive, industries, maxCallsPerMonth },
    update: { isActive: args.isActive, industries, maxCallsPerMonth },
    select: { id: true },
  })
}

export const INVITE_SUBJECT = 'Would you take one call a month from a {{college}} alum?'
export const INVITE_BODY = `Hi {{firstName}},

{{college}} alumni between jobs, changing careers or going for the next level tell us the most useful thing is 20 minutes with someone who's been there.

Would you take a call or two a month? You choose your industries and how many; your email is shared only when you accept a request.

Yes, count me in: {{link}}

{{college}} Alumni Relations`

// Alumni Relations invites alumni who aren't mentors yet, oldest classes
// first, in batches.
export async function inviteMentors(args: { institutionId: string; createdBy: string; limit?: number }) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: args.institutionId }, select: { slug: true } })
  const since = new Date(Date.now() - 180 * DAY)
  const candidates = await prisma.institutionMember.findMany({
    where: {
      institutionId: args.institutionId,
      affiliation: { in: ['ALUM', 'STAFF_ALUM'] },
      status: { not: 'OPTED_OUT' },
      doNotContact: false,
      mentorProfile: null,
      transitionFlags: { none: { openFlagMemberId: { not: null } } },
      // Not invited in the last six months.
      outreachSends: { none: { createdAt: { gte: since }, campaign: { type: 'MENTOR_INVITE' } } },
      classYear: { lte: new Date().getUTCFullYear() - 5 },
    },
    orderBy: { classYear: 'asc' },
    take: args.limit ?? 100,
    select: { id: true },
  })
  if (!candidates.length) return { sent: 0, skipped: 0, demo: false }
  return sendCampaign({
    institutionId: args.institutionId,
    type: 'MENTOR_INVITE',
    subject: INVITE_SUBJECT,
    body: INVITE_BODY,
    createdBy: args.createdBy,
    recipients: candidates.map((c) => ({ memberId: c.id })),
    linkFor: (_m, token) => `${appUrl()}/i/${inst.slug}/mentor/join?t=${encodeURIComponent(token)}`,
  })
}

export async function countMentorInvitable(institutionId: string) {
  const since = new Date(Date.now() - 180 * DAY)
  return prisma.institutionMember.count({
    where: {
      institutionId,
      affiliation: { in: ['ALUM', 'STAFF_ALUM'] },
      status: { not: 'OPTED_OUT' },
      doNotContact: false,
      mentorProfile: null,
      transitionFlags: { none: { openFlagMemberId: { not: null } } },
      outreachSends: { none: { createdAt: { gte: since }, campaign: { type: 'MENTOR_INVITE' } } },
      classYear: { lte: new Date().getUTCFullYear() - 5 },
    },
  })
}

// Alumni Relations › Mentors.
// "N alumni work here", for a job's company: roster employer, or a
// NextChapter employer for members who share their outcome. A count only.
export async function alumniAtCompanies(institutionId: string, companies: { companyId: string | null; normalized: string }[]) {
  if (!companies.length) return new Map<string, number>()
  const keys = companies.map((c) => `${c.companyId ?? ''}|${c.normalized}`)
  const rows = await prisma.$queryRaw<{ key: string; n: number }[]>`
    with c as (
      select * from unnest(${keys}::text[], ${companies.map((c) => c.companyId ?? '')}::text[], ${companies.map((c) => c.normalized)}::text[]) as c(key, company_id, name)
    )
    select c.key, count(distinct m.id)::int as n
    from c
    join public."InstitutionMember" m on m."institutionId" = ${institutionId} and m.status <> 'OPTED_OUT'
    left join private.v_member_consent mc on mc."memberId" = m.id
    where m."lastKnownEmployerNormalized" = c.name
       or (mc."shareOutcome" and exists (
            select 1 from public."MemberEmployment" me
            where me."candidateId" = m."candidateId" and me."isCurrent" and me."companyId" = c.company_id))
    group by c.key`
  const byKey = new Map(rows.map((r) => [r.key, r.n]))
  return new Map(keys.map((k) => [k, byKey.get(k) ?? 0]))
}
