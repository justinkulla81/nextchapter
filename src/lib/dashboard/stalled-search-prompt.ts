import 'server-only'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { getRecurringTargetCount } from '@/lib/weekly/action-effort'

export type StalledSearchTier = 1 | 2

export interface StalledSearchPromptEval {
  tier: StalledSearchTier
  weeksStreak: number
  showInterimSuggestion: boolean
  showCoachSuggestion: boolean
}

const THROTTLE_DAYS = 14
const TIER_2_WEEKS = 4
const MAX_WEEKS_CHECKED = 4
const MS_PER_DAY = 24 * 60 * 60 * 1000

const APPLICATION_WEEKLY_TARGET = getRecurringTargetCount('JOB_APPLICATION_SUBMITTED') ?? 3
const OUTREACH_WEEKLY_TARGET = getRecurringTargetCount('OUTREACH_MESSAGE') ?? 2

// Real, timestamped ground truth rather than WeeklySprint.committedActions —
// that blob is a self-picked, round-robin mix of any action types, so a
// candidate can hit their points target without ever committing to
// applications or outreach at all. "Hit goals" here means both real
// application volume AND real outreach volume cleared that week's target,
// independent of whatever they happened to commit to in their Sprint.
async function weekHitGoals(candidateId: string, weekStart: Date, weekEnd: Date): Promise<boolean> {
  const [applied, outreach] = await Promise.all([
    prisma.jobPosting.count({ where: { candidateId, appliedAt: { gte: weekStart, lt: weekEnd } } }),
    prisma.outreachLog.count({ where: { candidateId, loggedAt: { gte: weekStart, lt: weekEnd } } }),
  ])
  return applied >= APPLICATION_WEEKLY_TARGET && outreach >= OUTREACH_WEEKLY_TARGET
}

// Read-only — never writes. Same compute-on-render contract as
// evaluatePassiveToActivePrompt (src/lib/dashboard/passive-to-active-prompt.ts);
// the caller (recordStalledSearchPromptShown in src/app/dashboard/actions.ts)
// is the only place that persists anything, and only once the card actually
// renders client-side.
export async function evaluateStalledSearchPrompt(candidateId: string): Promise<StalledSearchPromptEval | null> {
  const profile = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: {
      stalledSearchPromptDontAskAgain: true,
      stalledSearchPromptLastShownAt: true,
      coachId: true,
    },
  })

  if (profile.stalledSearchPromptDontAskAgain) return null

  const now = Date.now()
  if (profile.stalledSearchPromptLastShownAt) {
    const daysSinceShown = (now - profile.stalledSearchPromptLastShownAt.getTime()) / MS_PER_DAY
    if (daysSinceShown < THROTTLE_DAYS) return null
  }

  // The in-progress current week is excluded — it isn't complete yet, so a
  // miss-so-far there shouldn't break an otherwise-real streak, and a hit
  // there shouldn't count as a completed week either. Walk backward from
  // the most recent completed week (last Monday through this Monday).
  const currentWeekStart = getMondayOfWeek(new Date())
  let weeksStreak = 0
  for (let i = 1; i <= MAX_WEEKS_CHECKED; i++) {
    const weekEnd = new Date(currentWeekStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() - (i - 1) * 7)
    const weekStart = new Date(weekEnd)
    weekStart.setUTCDate(weekStart.getUTCDate() - 7)

    if (!(await weekHitGoals(candidateId, weekStart, weekEnd))) break
    weeksStreak++
  }

  if (weeksStreak < 2) return null

  const windowStart = new Date(currentWeekStart)
  windowStart.setUTCDate(windowStart.getUTCDate() - weeksStreak * 7)

  const [interviewsLanded, calendarInterviews] = await Promise.all([
    prisma.jobPosting.count({ where: { candidateId, interviewLandedAt: { gte: windowStart } } }),
    prisma.trackedCalendarEvent.count({
      where: { candidateId, eventType: 'INTERVIEW', dismissedAt: null, startTime: { gte: windowStart } },
    }),
  ])

  // They're hitting goals AND getting interviews — nothing to flag.
  if (interviewsLanded > 0 || calendarInterviews > 0) return null

  const interimSignupCount = await prisma.interimMarketplaceSignup.count({ where: { candidateId } })

  return {
    tier: weeksStreak >= TIER_2_WEEKS ? 2 : 1,
    weeksStreak,
    showInterimSuggestion: interimSignupCount === 0,
    showCoachSuggestion: !profile.coachId,
  }
}
