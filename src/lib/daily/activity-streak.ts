import 'server-only'
import { prisma } from '@/lib/prisma'

const DAY = 24 * 60 * 60 * 1000
// Same UTC day boundary as the mood check-in (lib/daily/mood.ts), kept
// local so the two modules don't import each other.
const startOfUTCDay = (d: Date) => { const c = new Date(d); c.setUTCHours(0, 0, 0, 0); return c }
const LOOKBACK_DAYS = 400
// Outbound email the inbox sync classifies as networking (same list Market
// Reality's search diagnosis counts as networking touches).
const NETWORKING_EMAIL_TYPES = ['THANK_YOU', 'FOLLOW_UP', 'CHECK_IN', 'INTRO_REQUEST', 'NETWORKING_OUTREACH'] as const

/**
 * Consecutive days, counting back from today, that hold at least one active
 * day. Today counts when it's active; when it isn't yet, the streak runs
 * from yesterday, so it doesn't read as broken before the day is over.
 * Pure: exported for tests.
 */
export function streakFromActiveDays(activeDays: Set<number>, now: Date = new Date()): number {
  let day = startOfUTCDay(now).getTime()
  if (!activeDays.has(day)) day -= DAY
  let streak = 0
  while (activeDays.has(day)) {
    streak++
    day -= DAY
  }
  return streak
}

/**
 * The UTC days a candidate did real search work: checked in, applied to a
 * job, logged outreach, sent a networking email, completed a Sprint action
 * or had a meeting. Check-in days are included, so streaks built from daily
 * check-ins carry over.
 */
export async function getActiveDays(candidateId: string, now: Date = new Date()): Promise<Set<number>> {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * DAY)
  const [checkIns, applications, outreach, emails, meetings, sprints] = await Promise.all([
    prisma.dailyCheckIn.findMany({ where: { candidateId, checkedInAt: { gte: since } }, select: { checkedInAt: true } }),
    prisma.jobPosting.findMany({ where: { candidateId, appliedAt: { gte: since, lte: now } }, select: { appliedAt: true } }),
    prisma.outreachLog.findMany({ where: { candidateId, loggedAt: { gte: since } }, select: { loggedAt: true } }),
    prisma.trackedEmailActivity.findMany({
      where: { candidateId, direction: 'OUTBOUND', dismissedAt: null, activityType: { in: [...NETWORKING_EMAIL_TYPES] }, detectedAt: { gte: since, lte: now } },
      select: { detectedAt: true },
    }),
    prisma.trackedCalendarEvent.findMany({
      where: { candidateId, dismissedAt: null, startTime: { gte: since, lte: now } },
      select: { startTime: true },
    }),
    prisma.weeklySprint.findMany({ where: { candidateId, weekStartDate: { gte: new Date(since.getTime() - 7 * DAY) } }, select: { committedActions: true } }),
  ])

  const days = new Set<number>()
  const add = (d: Date | null | undefined) => { if (d && d >= since && d <= now) days.add(startOfUTCDay(d).getTime()) }
  checkIns.forEach((r) => add(r.checkedInAt))
  applications.forEach((r) => add(r.appliedAt))
  outreach.forEach((r) => add(r.loggedAt))
  emails.forEach((r) => add(r.detectedAt))
  meetings.forEach((r) => add(r.startTime))
  for (const s of sprints) {
    const actions = Array.isArray(s.committedActions) ? (s.committedActions as { completed?: boolean; completedAt?: string | null }[]) : []
    for (const a of actions) if (a?.completed && a.completedAt) add(new Date(a.completedAt))
  }
  return days
}

/** Recomputes and stores currentStreak (and longestStreak). Returns the streak. */
export async function refreshActivityStreak(candidateId: string): Promise<number> {
  const now = new Date()
  const streak = streakFromActiveDays(await getActiveDays(candidateId, now), now)
  const current = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { currentStreak: true, longestStreak: true } })
  if (current && (current.currentStreak !== streak || current.longestStreak < streak)) {
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: { currentStreak: streak, longestStreak: Math.max(streak, current.longestStreak) },
    })
  }
  return streak
}
