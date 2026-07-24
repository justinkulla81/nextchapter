import 'server-only'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek, type CommittedAction } from '@/lib/weekly/sprint'
import { pointsNeededForA } from '@/lib/weekly/action-effort'

// Weekly badges (Prompt 51) — reset every week, re-earned fresh each week.
// Deliberately NOT persisted: every one of these is a simple derived fact
// from data that's already timestamped (WeeklySprint, OutreachLog,
// LearningBadge, EncouragementNote, JobPosting), same "compute live, don't
// store a duplicate" approach already used for src/lib/community/badges.ts.
//
// NAMING RULE: "A-List" is reserved exclusively for WEEKLY_SCORE_A_LIST —
// no other badge in this system (weekly or milestone) may use it.
export type WeeklyBadgeKey =
  | 'WEEKLY_SCORE_A_LIST'
  | 'TEAM_PLAYER'
  | 'WEEKLY_LEARNING'
  | 'WEEKLY_NETWORKING'
  | 'DETAIL_ORIENTED'
  | 'FULL_SPRINT'
  | 'HIGH_FIT_APPLICATIONS'

export const WEEKLY_BADGE_LABEL: Record<WeeklyBadgeKey, string> = {
  WEEKLY_SCORE_A_LIST: 'Weekly Search Score A-List',
  TEAM_PLAYER: 'Team Player',
  WEEKLY_LEARNING: 'Weekly Learning',
  WEEKLY_NETWORKING: 'Weekly Networking',
  DETAIL_ORIENTED: 'Detail-Oriented',
  FULL_SPRINT: 'Full Sprint',
  HIGH_FIT_APPLICATIONS: 'High-Fit Applications',
}

export const WEEKLY_BADGE_DESCRIPTION: Record<WeeklyBadgeKey, string> = {
  WEEKLY_SCORE_A_LIST: "This week's Weekly Search Score hit the A target.",
  TEAM_PLAYER: '3+ give-actions in the Support Network this week.',
  WEEKLY_LEARNING: '1+ Learning Engine action completed this week.',
  WEEKLY_NETWORKING: '3+ networking touches this week.',
  DETAIL_ORIENTED: 'Every one-time action committed to this week got done.',
  FULL_SPRINT: 'Everything committed to this week — one-time and recurring — got done.',
  HIGH_FIT_APPLICATIONS: '3-5 applications submitted this week with real tailored content.',
}

const TEAM_PLAYER_THRESHOLD = 3
const WEEKLY_NETWORKING_THRESHOLD = 3
const HIGH_FIT_MIN = 3
// Deliberate exception to "more is better": this badge caps at 5, no
// over-delivering bonus — see WEEKLY_BADGE_DESCRIPTION and the prompt spec.
const HIGH_FIT_CAP = 5

export interface WeeklyBadgeStatus {
  key: WeeklyBadgeKey
  label: string
  description: string
  earned: boolean
}

export async function computeWeeklyBadges(candidateId: string): Promise<WeeklyBadgeStatus[]> {
  const weekStartDate = getMondayOfWeek(new Date())
  const weekEnd = new Date(weekStartDate.getTime() + 7 * 86400000)

  const [priorSprintCount, currentSprint, encouragementSentThisWeek, outreachThisWeek, learningThisWeek, appliedThisWeek] =
    await Promise.all([
      prisma.weeklySprint.count({ where: { candidateId, weekStartDate: { lt: weekStartDate } } }),
      prisma.weeklySprint.findUnique({ where: { candidateId_weekStartDate: { candidateId, weekStartDate } } }),
      prisma.encouragementNote.count({ where: { fromCandidateId: candidateId, sentAt: { gte: weekStartDate, lt: weekEnd } } }),
      prisma.outreachLog.count({ where: { candidateId, loggedAt: { gte: weekStartDate, lt: weekEnd } } }),
      prisma.learningBadge.count({ where: { candidateId, completedAt: { gte: weekStartDate, lt: weekEnd } } }),
      prisma.jobPosting.findMany({
        where: { candidateId, appliedAt: { gte: weekStartDate, lt: weekEnd } },
        select: { tailoredBullets: true },
      }),
    ])

  const weekNumber = priorSprintCount + 1
  const pointsTarget = pointsNeededForA(weekNumber)
  const committedActions = currentSprint ? (currentSprint.committedActions as unknown as CommittedAction[]) : []

  const pointsAchieved = committedActions.filter((a) => a.completed).reduce((sum, a) => sum + a.points, 0)
  const peerSupportActionsThisWeek = committedActions.filter(
    (a) => a.completed && a.actionType === 'ENGAGE_PEER_SUPPORT'
  ).length
  const giveActionsThisWeek = encouragementSentThisWeek + peerSupportActionsThisWeek

  const oneTimeActions = committedActions.filter((a) => !a.recurring)
  const allDetailOriented = oneTimeActions.length > 0 && oneTimeActions.every((a) => a.completed)
  const fullSprint = committedActions.length > 0 && committedActions.every((a) => a.completed)

  // "Real tailored content" — the analysis pipeline populates tailoredBullets
  // automatically for every posting fetched (not a separately-gated flow),
  // so a non-empty array is the closest real signal that meaningful
  // tailoring actually happened for that specific application.
  const tailoredApplicationsCount = appliedThisWeek.filter(
    (p) => Array.isArray(p.tailoredBullets) && (p.tailoredBullets as unknown[]).length > 0
  ).length
  const highFitCount = Math.min(tailoredApplicationsCount, HIGH_FIT_CAP)

  const earned: Record<WeeklyBadgeKey, boolean> = {
    WEEKLY_SCORE_A_LIST: pointsAchieved >= pointsTarget,
    TEAM_PLAYER: giveActionsThisWeek >= TEAM_PLAYER_THRESHOLD,
    WEEKLY_LEARNING: learningThisWeek >= 1,
    WEEKLY_NETWORKING: outreachThisWeek >= WEEKLY_NETWORKING_THRESHOLD,
    DETAIL_ORIENTED: allDetailOriented,
    FULL_SPRINT: fullSprint,
    HIGH_FIT_APPLICATIONS: highFitCount >= HIGH_FIT_MIN,
  }

  const earnedKeys = (Object.keys(earned) as WeeklyBadgeKey[]).filter((key) => earned[key])
  if (earnedKeys.length > 0) {
    // Fire-and-forget persistence for admin's historical archive — this is
    // the only place any weekly badge (including WEEKLY_SCORE_A_LIST, which
    // IS the A-List membership record) gets written down. Upsert is
    // idempotent, so re-computing the same week repeatedly is harmless.
    await Promise.all(
      earnedKeys.map((badgeKey) =>
        prisma.weeklyBadgeEarned
          .upsert({
            where: { candidateId_weekStartDate_badgeKey: { candidateId, weekStartDate, badgeKey } },
            update: {},
            create: { candidateId, weekStartDate, badgeKey },
          })
          .catch((error) => console.error('Failed to persist weekly badge:', error))
      )
    )
  }

  return (Object.keys(WEEKLY_BADGE_LABEL) as WeeklyBadgeKey[]).map((key) => ({
    key,
    label: WEEKLY_BADGE_LABEL[key],
    description: WEEKLY_BADGE_DESCRIPTION[key],
    earned: earned[key],
  }))
}
