import 'server-only'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { applicationsToAsk, chooseCheckInKind, isPromptDue, type CheckInKind } from '@/lib/daily/check-in-schedule'

const DEFAULT_WEEKLY_APPLICATION_GOAL = 15
const NETWORKING_EMAIL_TYPES = ['THANK_YOU', 'FOLLOW_UP', 'CHECK_IN', 'INTRO_REQUEST', 'NETWORKING_OUTREACH'] as const

export interface CheckInPromptView {
  kind: CheckInKind
  firstName: string | null
  /** Week-to-date applications (APPLY) or outreach (NETWORK). */
  countThisWeek: number
  /** How many to ask for today. */
  askedCount: number
  weeklyGoal: number
}

/** This week's applications and networking (logged outreach plus networking emails the inbox sync saw). */
export async function getWeekToDateActivity(candidateId: string, now: Date = new Date()) {
  const weekStart = getMondayOfWeek(now)
  const [applied, outreach, networkingEmails, checkIns] = await Promise.all([
    prisma.jobPosting.count({ where: { candidateId, appliedAt: { gte: weekStart, lte: now } } }),
    prisma.outreachLog.count({ where: { candidateId, loggedAt: { gte: weekStart } } }),
    prisma.trackedEmailActivity.count({
      where: { candidateId, direction: 'OUTBOUND', dismissedAt: null, activityType: { in: [...NETWORKING_EMAIL_TYPES] }, detectedAt: { gte: weekStart, lte: now } },
    }),
    prisma.dailyCheckIn.count({ where: { candidateId, checkedInAt: { gte: weekStart } } }),
  ])
  return { applied, networking: outreach + networkingEmails, checkedInThisWeek: checkIns > 0 }
}

/**
 * The pop-up to show when the candidate opens the app, or null when it isn't
 * due (at most 3 times a week, never two days running).
 */
export async function getCheckInPrompt(candidateId: string): Promise<CheckInPromptView | null> {
  const now = new Date()
  const recent = await prisma.checkInPrompt.findMany({
    where: { candidateId, shownAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
    orderBy: { shownAt: 'desc' },
    select: { kind: true, shownAt: true },
  })
  if (!isPromptDue(recent.map((r) => r.shownAt), now)) return null

  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { firstName: true, applicationVolumeGoal: true },
  })
  if (!candidate) return null
  const weeklyGoal = candidate.applicationVolumeGoal && candidate.applicationVolumeGoal > 0 ? candidate.applicationVolumeGoal : DEFAULT_WEEKLY_APPLICATION_GOAL
  const activity = await getWeekToDateActivity(candidateId, now)

  const lastShownByKind: Partial<Record<CheckInKind, Date>> = {}
  for (const r of recent) if (!lastShownByKind[r.kind]) lastShownByKind[r.kind] = r.shownAt
  const kind = chooseCheckInKind({ appliedThisWeek: activity.applied, weeklyGoal, checkedInThisWeek: activity.checkedInThisWeek, lastShownByKind })

  return {
    kind,
    firstName: candidate.firstName,
    countThisWeek: kind === 'APPLY_COMMIT' ? activity.applied : kind === 'NETWORK_COMMIT' ? activity.networking : 0,
    askedCount: kind === 'APPLY_COMMIT' ? applicationsToAsk(activity.applied, weeklyGoal, now) : 1,
    weeklyGoal,
  }
}
