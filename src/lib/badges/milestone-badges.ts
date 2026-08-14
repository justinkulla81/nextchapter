import 'server-only'
import { prisma } from '@/lib/prisma'
import { pointsNeededForA, getEarnedPoints } from '@/lib/weekly/action-effort'
import type { CommittedAction } from '@/lib/weekly/sprint'
import type { NamedReason } from '@/lib/scoring/named-reasons'
import { isDossierComplete } from '@/lib/reports/dossier-sections'
import { computeCurrentSprintStreak } from '@/lib/scoring/market-reality/effort'
import { computeDossierCompleteness } from '@/lib/scoring/dossier-unlock'

// Milestone badges (Prompt 51) — earned once, permanent, never reset.
// Computed live from existing data, same "don't persist a duplicate"
// approach as weekly-badges.ts. GAP_CLOSER is the one badge in this system
// that can be earned more than once — see `count` on MilestoneBadgeStatus.
//
// NAMING RULE: none of these may use "A-List" — that name is reserved for
// the real, multi-week Current Market Reality A tier, never the weekly
// WEEKLY_SPRINT_TARGET_HIT badge (see weekly-badges.ts).
// CLEANED_UP / ASKED / KNOWN / BACKED / CONSISTENT / DOCUMENTED are the six
// Master Build Script §7.8 badges. CONNECTED (LinkedIn or Gmail linked) is
// deliberately NOT one of them — §7.8: "does NOT qualify for Community...
// 'everyone here has done the work' has to be true." Never add it here.
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
  | 'CLEANED_UP'
  | 'ASKED'
  | 'KNOWN'
  | 'BACKED'
  | 'CONSISTENT'
  | 'DOCUMENTED'
  | 'INSIDER'
  | 'GUIDE'
  | 'CONTRIBUTOR'

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
  CLEANED_UP: 'Cleaned Up',
  ASKED: 'Asked',
  KNOWN: 'Known',
  BACKED: 'Backed',
  CONSISTENT: 'Consistent',
  DOCUMENTED: 'Documented',
  INSIDER: 'Insider',
  GUIDE: 'Guide',
  CONTRIBUTOR: 'Contributor',
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
  CLEANED_UP: 'Resolved a flagged resume issue with an explanation.',
  ASKED: 'Sent your first reference request.',
  KNOWN: 'Your profile is 100% filled in.',
  BACKED: 'Your first reference came back.',
  CONSISTENT: '3 Weekly Search Sprints in a row.',
  DOCUMENTED: 'Your Dossier is complete — all 7 requirements met.',
  INSIDER: 'Answered your first insider request.',
  GUIDE: 'Answered 5 insider requests.',
  CONTRIBUTOR: 'Published 10 pieces of company intel.',
}

// Part C, Prompt 4.4's own thresholds — Insider/Guide are literal counts
// from the spec ("Insider (answered 1 request) · Guide (answered 5)");
// Contributor's "10 pieces of published intel" is also the spec's literal
// number, but counted against status: 'published' rows only (a submission
// that's held or removed by moderation was never real, usable guidance —
// see src/lib/companies/company-intel.ts).
const GUIDE_ANSWERED_THRESHOLD = 5
const CONTRIBUTOR_PUBLISHED_THRESHOLD = 10

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

// Oldest-to-newest so weekNumber (and therefore the target ramp) lines up
// with when each week actually happened. Shared by the streak computation
// below and by countOverDeliveringWeeks (Dossier grit stat) — same
// per-week "did this week beat its A-grade target" boolean, two different
// reductions of it.
function overDeliveredByWeek(sprints: { weekStartDate: Date; committedActions: unknown }[]): boolean[] {
  const ordered = [...sprints].sort((a, b) => a.weekStartDate.getTime() - b.weekStartDate.getTime())
  return ordered.map((sprint, i) => {
    const actions = sprint.committedActions as unknown as CommittedAction[]
    const achieved = actions.reduce((sum, a) => sum + getEarnedPoints(a), 0)
    const target = pointsNeededForA(i + 1)
    return achieved > target
  })
}

function computeOverDeliveringStreak(sprints: { weekStartDate: Date; committedActions: unknown }[]): number {
  const flags = overDeliveredByWeek(sprints)
  let streak = 0
  for (let i = flags.length - 1; i >= 0; i--) {
    if (!flags[i]) break
    streak++
  }
  return streak
}

// Full-history count (not just the trailing streak) — powers the Dossier's
// "How I Operate" grit/consistency stat (dossier-sections.ts).
export async function countOverDeliveringWeeks(candidateId: string): Promise<number> {
  const sprints = await prisma.weeklySprint.findMany({
    where: { candidateId },
    select: { weekStartDate: true, committedActions: true },
  })
  return overDeliveredByWeek(sprints).filter(Boolean).length
}

export async function computeMilestoneBadges(candidateId: string): Promise<MilestoneBadgeStatus[]> {
  const [
    candidate,
    checkIns,
    allSprints,
    references,
    latestAiProject,
    marketRealitySnapshots,
    dossierComplete,
    resolvedReviewerQuestionCount,
    profileFieldsConfirmed,
    threeWeekSprintStreak,
    dossierCompleteness,
    insiderRequestsAnswered,
    publishedIntelCount,
  ] = await Promise.all([
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
    isDossierComplete(candidateId),
    // CLEANED_UP (§7.8) — the resume tools' real "issue applied a fix"
    // tracking is §13 (task #959), not built yet. candidateExplanation is
    // the closest existing signal (a flagged issue the candidate resolved
    // by explaining it — "neutralizes," per schema.prisma's own comment on
    // ReviewerQuestion) — an honest proxy, not the same thing as a fix
    // actually being applied to the document.
    prisma.reviewerQuestion.count({ where: { candidateId, candidateExplanation: { not: null } } }),
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        profileConfirmedAt: true,
        industryConfirmedAt: true,
        functionConfirmedAt: true,
        salaryConfirmedAt: true,
        workAuthConfirmedAt: true,
        linkedInConfirmedAt: true,
      },
    }),
    computeCurrentSprintStreak(candidateId, 3),
    computeDossierCompleteness(candidateId),
    prisma.insiderRequest.count({ where: { insiderCandidateId: candidateId, status: 'answered' } }),
    prisma.companyIntel.count({ where: { contributorCandidateId: candidateId, status: 'published' } }),
  ])

  const comeback = detectComeback(checkIns.map((c) => c.checkedInAt))
  const overDeliveringStreak = computeOverDeliveringStreak(allSprints)
  const landedInterimRole = candidate.workHistory.some(
    (w) => w.engagementType === 'FRACTIONAL' || w.engagementType === 'INTERIM'
  )

  const referenceChampion = references.length > 0 && references.every((r) => r.status === 'COMPLETED')
  const profileKnown =
    [
      profileFieldsConfirmed.profileConfirmedAt,
      profileFieldsConfirmed.industryConfirmedAt,
      profileFieldsConfirmed.functionConfirmedAt,
      profileFieldsConfirmed.salaryConfirmedAt,
      profileFieldsConfirmed.workAuthConfirmedAt,
      profileFieldsConfirmed.linkedInConfirmedAt,
    ].filter((v) => v !== null).length === 6

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
    CLEANED_UP: resolvedReviewerQuestionCount > 0,
    ASKED: references.length > 0,
    KNOWN: profileKnown,
    BACKED: references.some((r) => r.status === 'COMPLETED'),
    CONSISTENT: threeWeekSprintStreak >= 3,
    DOCUMENTED: dossierCompleteness.isComplete,
    INSIDER: insiderRequestsAnswered >= 1,
    GUIDE: insiderRequestsAnswered >= GUIDE_ANSWERED_THRESHOLD,
    CONTRIBUTOR: publishedIntelCount >= CONTRIBUTOR_PUBLISHED_THRESHOLD,
  }

  return (Object.keys(MILESTONE_BADGE_LABEL) as MilestoneBadgeKey[]).map((key) => ({
    key,
    label: MILESTONE_BADGE_LABEL[key],
    description: MILESTONE_BADGE_DESCRIPTION[key],
    earned: earned[key],
    ...(key === 'GAP_CLOSER' ? { count: gapCloserCount } : {}),
  }))
}
