// One alum's journey with the college, as staff see it (owner, 2026-11-21): what happened, when, and which office acted,
// newest first. Shared details follow the alum's consent: a new job and gifts only when they share outcomes, journey
// changes and engagement only when they share engagement. Never a reason for a search (TransitionFlag.reason).
//
// Cost: one member and at most 20 rows from each of ~10 small per-member reads (indexed on memberId or candidateId),
// when a staff member opens one alum.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { getJourney } from '@/lib/journey/journey'
import { CHECKIN_ANSWERS } from './checkins'

export type JourneyItem = { at: Date; what: string; office: string }
const DOS = 20

export async function memberJourney(institutionId: string, memberId: string, offices: Record<'alumni' | 'career' | 'development' | 'execed' | 'ventures', string>): Promise<{ name: string; classYear: number | null; items: JourneyItem[] } | null> {
  const m = await prisma.institutionMember.findFirst({
    where: { id: memberId, institutionId },
    select: { firstName: true, lastName: true, classYear: true, claimedAt: true, candidateId: true },
  })
  if (!m) return null
  const [consent] = await prisma.$queryRaw<{ shareOutcome: boolean; shareEngagement: boolean }[]>`
    select "shareOutcome", "shareEngagement" from private.v_member_consent where "memberId" = ${memberId}`
  const outcomes = consent?.shareOutcome ?? false
  const engagement = consent?.shareEngagement ?? false
  const [journey, checkIns, caseload, flags, reports, opened, enrolled, gifts, signals, ventures, layoffs] = await Promise.all([
    engagement && m.candidateId ? prisma.journeyEvent.findMany({ where: { candidateId: m.candidateId, toJourney: { not: null } }, orderBy: { createdAt: 'desc' }, take: DOS, select: { createdAt: true, toJourney: true } }) : [],
    prisma.checkIn.findMany({ where: { memberId, status: 'RESPONDED' }, orderBy: { respondedAt: 'desc' }, take: DOS, select: { respondedAt: true, responseJson: true } }),
    prisma.caseloadAssignment.findMany({ where: { memberId }, orderBy: { assignedAt: 'desc' }, take: DOS, select: { assignedAt: true, counselor: { select: { fullName: true } } } }),
    prisma.transitionFlag.findMany({ where: { memberId }, orderBy: { startedAt: 'desc' }, take: DOS, select: { startedAt: true, clearedAt: true, doNotSolicit: true } }),
    outcomes ? prisma.outcomeReport.findMany({ where: { memberId }, orderBy: { reportedAt: 'desc' }, take: DOS, select: { reportedAt: true, helpedByInstitution: true } }) : [],
    prisma.skillBridgeEvent.findMany({ where: { memberId, kind: 'OPENED' }, orderBy: { createdAt: 'desc' }, take: DOS, select: { createdAt: true, skill: true } }),
    prisma.enrollment.findMany({ where: { memberId }, orderBy: { appliedAt: 'desc' }, take: DOS, select: { appliedAt: true, status: true, cohort: { select: { program: { select: { name: true } } } } } }),
    outcomes ? prisma.institutionGift.findMany({ where: { memberId }, orderBy: { giftDate: 'desc' }, take: DOS, select: { giftDate: true } }) : [],
    prisma.prospectFlag.findMany({ where: { memberId, dismissedAt: null }, orderBy: { detectedAt: 'desc' }, take: DOS, select: { detectedAt: true, type: true } }),
    prisma.ventureFlag.findMany({ where: { memberId }, take: DOS, select: { firstFlaggedAt: true, status: true } }),
    prisma.layoffMatch.findMany({ where: { memberId }, orderBy: { matchedAt: 'desc' }, take: DOS, select: { matchedAt: true } }),
  ])
  const answerLabel = (a: unknown) => CHECKIN_ANSWERS.find((x) => x.key === a)?.label ?? 'answered'
  const SIGNAL = { PROMOTION_VP_PLUS: 'Promoted to VP or above', EXIT: 'Their company was sold or went public', NEW_EMPLOYER_MATCHING_GIFT: 'New employer with a matching-gift program' } as const
  const items: JourneyItem[] = [
    ...(m.claimedAt ? [{ at: m.claimedAt, what: 'Joined the college’s career portal', office: offices.alumni }] : []),
    ...journey.map((j) => ({ at: j.createdAt, what: `Their situation: ${getJourney(j.toJourney!).label.toLowerCase()}`, office: 'The alum' })),
    ...checkIns.filter((c) => c.respondedAt).map((c) => ({ at: c.respondedAt!, what: `Answered a check-in: “${answerLabel((c.responseJson as { answer?: unknown } | null)?.answer)}”`, office: offices.career })),
    ...caseload.map((c) => ({ at: c.assignedAt, what: `On ${c.counselor.fullName ? `${c.counselor.fullName}’s` : 'an advisor’s'} caseload`, office: offices.career })),
    ...flags.flatMap((f) => [
      ...(f.doNotSolicit ? [{ at: f.startedAt, what: 'In a search: donation asks paused', office: offices.development }] : []),
      ...(f.clearedAt ? [{ at: f.clearedAt, what: 'Search over: asks can resume after the quiet period', office: offices.development }] : []),
    ]),
    ...reports.map((r) => ({ at: r.reportedAt, what: r.helpedByInstitution ? 'Reported a new job, and said the college helped' : 'Reported a new job', office: offices.career })),
    ...opened.map((o) => ({ at: o.createdAt, what: `Opened a program for a skills gap: ${o.skill}`, office: offices.execed })),
    ...enrolled.map((e) => ({ at: e.appliedAt, what: `Applied to ${e.cohort.program.name}`, office: offices.execed })),
    ...gifts.map((g) => ({ at: g.giftDate, what: 'Made a gift', office: offices.development })),
    ...signals.map((s) => ({ at: s.detectedAt, what: SIGNAL[s.type], office: offices.development })),
    ...ventures.map((v) => ({ at: v.firstFlaggedAt, what: v.status === 'STARTED' ? 'Started a company' : 'Thinking about starting a company', office: offices.ventures })),
    ...layoffs.map((l) => ({ at: l.matchedAt, what: 'Their employer filed a layoff notice', office: offices.alumni })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime())
  return { name: [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Unnamed', classYear: m.classYear, items }
}
