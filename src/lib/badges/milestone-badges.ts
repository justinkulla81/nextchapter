import 'server-only'
import { prisma } from '@/lib/prisma'
import { pointsNeededForA } from '@/lib/weekly/action-effort'
import type { CommittedAction } from '@/lib/weekly/sprint'
import type { NamedReason } from '@/lib/scoring/named-reasons'
import { getDossierSections } from '@/lib/reports/dossier-sections'

// Milestone badges (Prompt 51) — earned once, permanent, never reset.
// Computed live from existing data, same "don't persist a duplicate"
// approach as weekly-badges.ts. GAP_CLOSER is the one badge in this system
// that can be earned more than once — see `count` on MilestoneBadgeStatus.
//
// NAMING RULE: none of these may use "A-List" — that's reserved for the
// weekly Weekly Search Score badge only (see weekly-badges.ts).
export type MilestoneBadgeKey =
  | 'SEVEN_DAY_STREAK'
  | 'THIRTY_DAY_STREAK'
  | 'NINETY_DAY_STREAK'
  | 'COMEBACK'
  | 'OVER_DELIVERING_STREAK'
  | 'LANDED_INTERIM_ROLE'
  | 'DOSSIER_COMPLETE'
  | 'REFERENCE_CHAMPION'
  | 'AI_FLUENT'
  | 'GAP_CLOSER'

export const MILESTONE_BADGE_LABEL: Record<MilestoneBadgeKey, string> = {
  SEVEN_DAY_STREAK: '7-Day Streak',
  THIRTY_DAY_STREAK: '30-Day Streak',
  NINETY_DAY_STREAK: '90-Day Streak',
  COMEBACK: 'Comeback',
  OVER_DELIVERING_STREAK: 'Over-Delivering Streak',
  LANDED_INTERIM_ROLE: 'Landed an Interim Role',
  DOSSIER_COMPLETE: 'Dossier Complete',
  REFERENCE_CHAMPION: 'Reference Champion',
  AI_FLUENT: 'AI Fluent',
  GAP_CLOSER: 'Gap Closer',
}

export const MILESTONE_BADGE_DESCRIPTION: Record<MilestoneBadgeKey, string> = {
  SEVEN_DAY_STREAK: 'Checked in 7 days in a row.',
  THIRTY_DAY_STREAK: 'Checked in 30 days in a row.',
  NINETY_DAY_STREAK: 'Checked in 90 days in a row.',
  COMEBACK: 'Came back and kept going after a break.',
  OVER_DELIVERING_STREAK: 'Multiple weeks in a row beating the Weekly Search Score target.',
  LANDED_INTERIM_ROLE: 'Landed a fractional or interim placement.',
  DOSSIER_COMPLETE: 'Every section of your Executive Dossier has real content.',
  REFERENCE_CHAMPION: 'Every reference you invited has completed the intake form.',
  AI_FLUENT: 'Captured a real AI Fluency example.',
  GAP_CLOSER: 'Closed a named Market Reality gap.',
}

const COMEBACK_GAP_DAYS = 7
const OVER_DELIVERING_STREAK_MIN = 2

export interface MilestoneBadgeStatus {
  key: MilestoneBadgeKey
  label: string
  description: string
  earned: boolean
  count?: number // only meaningful for GAP_CLOSER
}

function detectComeback(checkInDates: Date[]): boolean {
  if (checkInDates.length < 2) return false
  const distinctDays = Array.from(
    new Set(checkInDates.map((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).getTime()))
  )
    .sort((a, b) => a - b)
    .map((t) => new Date(t))

  for (let i = 1; i < distinctDays.length; i++) {
    const gapDays = Math.round((distinctDays[i].getTime() - distinctDays[i - 1].getTime()) / 86400000)
    if (gapDays > COMEBACK_GAP_DAYS) return true
  }
  return false
}

function computeOverDeliveringStreak(sprints: { weekStartDate: Date; committedActions: unknown }[]): number {
  // Oldest-to-newest so weekNumber (and therefore the target ramp) lines up
  // with when each week actually happened.
  const ordered = [...sprints].sort((a, b) => a.weekStartDate.getTime() - b.weekStartDate.getTime())
  const overDeliveredByWeek = ordered.map((sprint, i) => {
    const actions = sprint.committedActions as unknown as CommittedAction[]
    const achieved = actions.filter((a) => a.completed).reduce((sum, a) => sum + a.points, 0)
    const target = pointsNeededForA(i + 1)
    return achieved > target
  })

  let streak = 0
  for (let i = overDeliveredByWeek.length - 1; i >= 0; i--) {
    if (!overDeliveredByWeek[i]) break
    streak++
  }
  return streak
}

export async function computeMilestoneBadges(candidateId: string): Promise<MilestoneBadgeStatus[]> {
  const [candidate, checkIns, allSprints, references, latestAiProject, marketRealitySnapshots, dossier] =
    await Promise.all([
      prisma.candidateProfile.findUniqueOrThrow({
        where: { id: candidateId },
        select: { longestStreak: true, workHistory: { select: { engagementType: true } } },
      }),
      prisma.dailyCheckIn.findMany({ where: { candidateId }, select: { checkedInAt: true }, take: 500 }),
      prisma.weeklySprint.findMany({ where: { candidateId }, select: { weekStartDate: true, committedActions: true } }),
      prisma.reference.findMany({ where: { candidateId }, select: { status: true } }),
      prisma.learningBadge.findFirst({
        where: { candidateId, badgeType: 'ai_project', judgmentCall: { not: null } },
      }),
      prisma.marketRealitySnapshot.findMany({
        where: { candidateId },
        orderBy: { weekStartDate: 'asc' },
        select: { namedReasons: true },
      }),
      getDossierSections(candidateId),
    ])

  const comeback = detectComeback(checkIns.map((c) => c.checkedInAt))
  const overDeliveringStreak = computeOverDeliveringStreak(allSprints)
  const landedInterimRole = candidate.workHistory.some(
    (w) => w.engagementType === 'FRACTIONAL' || w.engagementType === 'INTERIM'
  )

  const dossierComplete =
    Boolean(dossier.positioning.approvedText) &&
    (dossier.howIOperate.dimensionSummaries.length > 0 || dossier.howIOperate.superpowers.length > 0) &&
    (Boolean(dossier.whatDrivesMe.effortStatText) || Boolean(dossier.whatDrivesMe.motivationNarrative)) &&
    Boolean(dossier.aiFluencyExample) &&
    (dossier.impactOnPeople.quotes.length > 0 || Boolean(dossier.impactOnPeople.communityNarrative)) &&
    dossier.selfAwareness.growthEdges.length > 0 &&
    dossier.learningGrowth.items.length > 0 &&
    Boolean(dossier.fit.patternSummary) &&
    dossier.proofPoints.length > 0

  const referenceChampion = references.length > 0 && references.every((r) => r.status === 'COMPLETED')

  // Gap Closer: a named reason that was ever flagged as a 'gap' in an
  // earlier snapshot and no longer appears as a gap in the latest one —
  // counted once per distinct gap id, not just once total.
  let gapCloserCount = 0
  if (marketRealitySnapshots.length > 1) {
    const latest = marketRealitySnapshots[marketRealitySnapshots.length - 1].namedReasons as unknown as NamedReason[]
    const latestGapIds = new Set(latest.filter((r) => r.kind === 'gap').map((r) => r.id))
    const everSeenAsGap = new Set<string>()
    for (const snapshot of marketRealitySnapshots.slice(0, -1)) {
      const reasons = snapshot.namedReasons as unknown as NamedReason[]
      for (const r of reasons) {
        if (r.kind === 'gap') everSeenAsGap.add(r.id)
      }
    }
    for (const id of everSeenAsGap) {
      if (!latestGapIds.has(id)) gapCloserCount++
    }
  }

  const earned: Record<MilestoneBadgeKey, boolean> = {
    SEVEN_DAY_STREAK: candidate.longestStreak >= 7,
    THIRTY_DAY_STREAK: candidate.longestStreak >= 30,
    NINETY_DAY_STREAK: candidate.longestStreak >= 90,
    COMEBACK: comeback,
    OVER_DELIVERING_STREAK: overDeliveringStreak >= OVER_DELIVERING_STREAK_MIN,
    LANDED_INTERIM_ROLE: landedInterimRole,
    DOSSIER_COMPLETE: dossierComplete,
    REFERENCE_CHAMPION: referenceChampion,
    AI_FLUENT: Boolean(latestAiProject),
    GAP_CLOSER: gapCloserCount > 0,
  }

  return (Object.keys(MILESTONE_BADGE_LABEL) as MilestoneBadgeKey[]).map((key) => ({
    key,
    label: MILESTONE_BADGE_LABEL[key],
    description: MILESTONE_BADGE_DESCRIPTION[key],
    earned: earned[key],
    ...(key === 'GAP_CLOSER' ? { count: gapCloserCount } : {}),
  }))
}
