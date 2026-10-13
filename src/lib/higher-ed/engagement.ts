// Engagement events (spec §7, HE-07): turns activity NextChapter already
// records into EngagementEvent rows, scored by private.v_member_engagement.
// Idempotent: every row is unique on (sourceTable, sourceId, memberId, type),
// so the nightly run only ever adds what's new. Activity in the candidate
// product counts only for members who share engagement; gifts are the
// college's own data and always count.

import 'server-only'
import type { CaseEngagementCategory, EngagementEventType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Points and CASE category per event type (spec §7 table).
export const ENGAGEMENT_POINTS: Record<EngagementEventType, { points: number; category: CaseEngagementCategory }> = {
  LOGIN: { points: 1, category: 'COMMUNICATION' },
  OUTREACH_CLICK: { points: 1, category: 'COMMUNICATION' },
  MILESTONE_SHARED: { points: 2, category: 'COMMUNICATION' },
  TOOL_USE: { points: 2, category: 'EXPERIENTIAL' },
  COACHING_SESSION: { points: 3, category: 'EXPERIENTIAL' },
  EVENT: { points: 3, category: 'EXPERIENTIAL' },
  MENTOR_CALL: { points: 2, category: 'EXPERIENTIAL' }, // the requester; the mentor's side is VOLUNTEER, 5
  GIFT_PROMPT_CLICK: { points: 1, category: 'PHILANTHROPIC' },
  GIFT: { points: 10, category: 'PHILANTHROPIC' },
}

type Row = Prisma.EngagementEventCreateManyInput

function row(institutionId: string, memberId: string, type: EngagementEventType, occurredAt: Date, sourceTable: string, sourceId: string, override?: { points: number; category: CaseEngagementCategory }): Row {
  const p = override ?? ENGAGEMENT_POINTS[type]
  return { institutionId, memberId, type, caseCategory: p.category, points: p.points, occurredAt, sourceTable, sourceId }
}

// One mentor call: both people engaged, differently (spec §7).
// Office hours and alumni intros are calls too (sourceTable says which).
export function mentorCallRows(institutionId: string, requestId: string, mentorMemberId: string, requesterMemberId: string, at: Date, sourceTable = 'MentorRequest'): Row[] {
  return [
    row(institutionId, mentorMemberId, 'MENTOR_CALL', at, sourceTable, requestId, { points: 5, category: 'VOLUNTEER' }),
    row(institutionId, requesterMemberId, 'MENTOR_CALL', at, sourceTable, requestId),
  ]
}

export async function syncEngagement(institutionId: string, now = new Date()): Promise<{ added: number }> {
  const since = new Date(now.getTime() - 366 * 86_400_000)
  const members = await prisma.$queryRaw<{ id: string; candidateId: string | null; shareEngagement: boolean }[]>`
    select m.id, m."candidateId", mc."shareEngagement"
    from public."InstitutionMember" m join private.v_member_consent mc on mc."memberId" = m.id
    where m."institutionId" = ${institutionId}`
  const sharing = members.filter((m) => m.candidateId && m.shareEngagement)
  const memberByCandidate = new Map(sharing.map((m) => [m.candidateId as string, m.id]))
  const candidateIds = [...memberByCandidate.keys()]
  const rows: Row[] = []

  if (candidateIds.length) {
    const [logins, sprints, coaching] = await Promise.all([
      prisma.candidateLoginEvent.findMany({ where: { candidateId: { in: candidateIds }, createdAt: { gte: since } }, select: { id: true, candidateId: true, createdAt: true } }),
      prisma.weeklySprint.findMany({ where: { candidateId: { in: candidateIds }, weekStartDate: { gte: since } }, select: { id: true, candidateId: true, weekStartDate: true, committedActions: true } }),
      prisma.coachSession.findMany({ where: { candidateId: { in: candidateIds }, institutionId, occurredAt: { gte: since } }, select: { id: true, candidateId: true, occurredAt: true } }),
    ])
    for (const l of logins) rows.push(row(institutionId, memberByCandidate.get(l.candidateId)!, 'LOGIN', l.createdAt, 'CandidateLoginEvent', l.id))
    for (const s of sprints) {
      // A week with at least one completed action is a week of tool use.
      const done = Array.isArray(s.committedActions) && (s.committedActions as { completed?: boolean }[]).some((a) => a?.completed)
      if (done) rows.push(row(institutionId, memberByCandidate.get(s.candidateId)!, 'TOOL_USE', s.weekStartDate, 'WeeklySprint', s.id))
    }
    for (const c of coaching) rows.push(row(institutionId, memberByCandidate.get(c.candidateId)!, 'COACHING_SESSION', c.occurredAt, 'CoachSession', c.id))
  }

  const sharingIds = sharing.map((m) => m.id)
  const [clicks, milestones, gifts] = await Promise.all([
    prisma.outreachSend.findMany({
      where: { memberId: { in: members.filter((m) => m.shareEngagement).map((m) => m.id) }, OR: [{ clickedAt: { gte: since } }, { claimedAt: { gte: since } }] },
      select: { id: true, memberId: true, clickedAt: true, claimedAt: true },
    }),
    prisma.outcomeReport.findMany({ where: { memberId: { in: sharingIds }, shareMilestone: true, reportedAt: { gte: since } }, select: { id: true, memberId: true, reportedAt: true } }),
    prisma.institutionGift.findMany({ where: { institutionId, memberId: { not: null }, giftDate: { gte: since } }, select: { id: true, memberId: true, giftDate: true } }),
  ])
  for (const c of clicks) rows.push(row(institutionId, c.memberId!, 'OUTREACH_CLICK', (c.clickedAt ?? c.claimedAt)!, 'OutreachSend', c.id))
  for (const o of milestones) rows.push(row(institutionId, o.memberId, 'MILESTONE_SHARED', o.reportedAt, 'OutcomeReport', o.id))
  for (const g of gifts) rows.push(row(institutionId, g.memberId!, 'GIFT', g.giftDate, 'InstitutionGift', g.id))

  // Office hours that happened, accepted alumni intros and event check-ins:
  // each side counts only if that member shares engagement.
  const shares = new Set(members.filter((m) => m.shareEngagement).map((m) => m.id))
  const [slots, intros, checkins] = await Promise.all([
    prisma.officeHourSlot.findMany({
      where: { institutionId, bookedByMemberId: { not: null }, cancelledAt: null, startsAt: { gte: since, lte: now } },
      select: { id: true, startsAt: true, bookedByMemberId: true, mentor: { select: { memberId: true } } },
    }),
    prisma.alumniIntroRequest.findMany({ where: { institutionId, status: 'ACCEPTED', respondedAt: { gte: since } }, select: { id: true, respondedAt: true, requesterMemberId: true, targetMemberId: true } }),
    prisma.eventRsvp.findMany({ where: { event: { institutionId }, checkedInAt: { gte: since } }, select: { id: true, memberId: true, checkedInAt: true } }),
  ])
  for (const s of slots) rows.push(...mentorCallRows(institutionId, s.id, s.mentor.memberId, s.bookedByMemberId!, s.startsAt, 'OfficeHourSlot').filter((r) => shares.has(r.memberId)))
  for (const i of intros) rows.push(...mentorCallRows(institutionId, i.id, i.targetMemberId, i.requesterMemberId, i.respondedAt!, 'AlumniIntroRequest').filter((r) => shares.has(r.memberId)))
  for (const c of checkins) if (shares.has(c.memberId)) rows.push(row(institutionId, c.memberId, 'EVENT', c.checkedInAt!, 'EventRsvp', c.id))

  if (!rows.length) return { added: 0 }
  const r = await prisma.engagementEvent.createMany({ data: rows, skipDuplicates: true })
  return { added: r.count }
}

export type EngagementOverview = {
  tiers: { tier: 'High' | 'Medium' | 'Low'; members: number }[]
  byDecade: { decade: string; volunteer: number; experiential: number; philanthropic: number; communication: number; members: number }[]
}

// Alumni Relations › Engagement: tier distribution and CASE breakdown by
// class decade. Aggregates only; reconciles with EngagementEvent through the
// same view the directory uses.
export async function engagementOverview(institutionId: string): Promise<EngagementOverview> {
  const tiers = await prisma.$queryRaw<{ tier: 'High' | 'Medium' | 'Low'; members: number }[]>`
    select tier, count(*)::int as members from private.v_member_engagement where "institutionId" = ${institutionId} group by tier`
  const byDecade = await prisma.$queryRaw<EngagementOverview['byDecade']>`
    select coalesce((floor(m."classYear" / 10) * 10)::int::text || 's', 'Unknown') as decade,
      sum(e.volunteer)::int as volunteer, sum(e.experiential)::int as experiential,
      sum(e.philanthropic)::int as philanthropic, sum(e.communication)::int as communication, count(*)::int as members
    from private.v_member_engagement e join public."InstitutionMember" m on m.id = e."memberId"
    where e."institutionId" = ${institutionId}
    group by 1 order by 1`
  const order = ['High', 'Medium', 'Low'] as const
  return { tiers: order.map((t) => ({ tier: t, members: tiers.find((x) => x.tier === t)?.members ?? 0 })), byDecade }
}

// What a college can re-weight (Alumni Relations › Engagement). Stored in
// enabledFeatures.engagementWeights and applied by v_member_engagement, so a
// change re-scores the last 12 months. Monthly caps stay in points.
export const WEIGHT_KEYS: { key: string; label: string; category: CaseEngagementCategory; defaultPoints: number }[] = [
  { key: 'LOGIN', label: 'Signs in', category: 'COMMUNICATION', defaultPoints: 1 },
  { key: 'OUTREACH_CLICK', label: 'Opens a link in your email', category: 'COMMUNICATION', defaultPoints: 1 },
  { key: 'MILESTONE_SHARED', label: 'Shares a milestone', category: 'COMMUNICATION', defaultPoints: 2 },
  { key: 'TOOL_USE', label: 'A week using the tools', category: 'EXPERIENTIAL', defaultPoints: 2 },
  { key: 'COACHING_SESSION', label: 'A coaching session', category: 'EXPERIENTIAL', defaultPoints: 3 },
  { key: 'EVENT', label: 'Attends an event or finishes a program', category: 'EXPERIENTIAL', defaultPoints: 3 },
  { key: 'MENTOR_CALL', label: 'Gets a mentor call or intro', category: 'EXPERIENTIAL', defaultPoints: 2 },
  { key: 'MENTOR_CALL_MENTOR', label: 'Gives a mentor call or intro', category: 'VOLUNTEER', defaultPoints: 5 },
  { key: 'GIFT_PROMPT_CLICK', label: 'Opens a giving link', category: 'PHILANTHROPIC', defaultPoints: 1 },
  { key: 'GIFT', label: 'Makes a gift', category: 'PHILANTHROPIC', defaultPoints: 10 },
]

export function engagementWeightsFrom(enabledFeatures: unknown): Record<string, number> {
  const stored = ((enabledFeatures as { engagementWeights?: Record<string, unknown> } | null)?.engagementWeights ?? {}) as Record<string, unknown>
  return Object.fromEntries(WEIGHT_KEYS.map((w) => [w.key, typeof stored[w.key] === 'number' && Number.isInteger(stored[w.key]) ? (stored[w.key] as number) : w.defaultPoints]))
}

export async function saveEngagementWeights(institutionId: string, weights: Record<string, number> | null) {
  const row = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { enabledFeatures: true } })
  const clean = weights ? Object.fromEntries(WEIGHT_KEYS.map((w) => [w.key, Math.min(Math.max(Math.round(weights[w.key] ?? w.defaultPoints), 0), 20)])) : {}
  await prisma.institution.update({
    where: { id: institutionId },
    data: { enabledFeatures: { ...((row.enabledFeatures ?? {}) as Record<string, unknown>), engagementWeights: clean } },
  })
}
