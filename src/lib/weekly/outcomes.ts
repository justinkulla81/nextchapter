import 'server-only'
import { prisma } from '@/lib/prisma'
import { getNeedsFollowUpList } from '@/lib/network/needs-follow-up'

export interface WeeklyOutcomes {
  outreachCount: number
  applicationsCount: number
  interviewsLandedCount: number
  offersReceivedCount: number
  calendarMeetingsCount: number
  // Not week-scoped — getNeedsFollowUpList is lookback-window based, so this
  // is "currently owed," not "new this week." Label it that way wherever it
  // surfaces (e.g. the Weekly Focus prompt) to stay honest.
  followUpsPendingCount: number
}

// Real per-week activity counts, reused by both the Weekly Focus card
// (weekly-focus.ts) and the Coaching Notes job-activity breakdown (#855) —
// one small aggregator rather than two call sites each re-deriving the same
// counts.
export async function getWeeklyOutcomes(candidateId: string, weekStartDate: Date): Promise<WeeklyOutcomes> {
  const weekEnd = new Date(weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [outreachCount, applicationsCount, interviewsLandedCount, offersReceivedCount, calendarMeetingsCount, followUps] =
    await Promise.all([
      prisma.outreachLog.count({ where: { candidateId, loggedAt: { gte: weekStartDate, lt: weekEnd } } }),
      prisma.jobPosting.count({ where: { candidateId, appliedAt: { gte: weekStartDate, lt: weekEnd } } }),
      prisma.jobPosting.count({ where: { candidateId, interviewLandedAt: { gte: weekStartDate, lt: weekEnd } } }),
      prisma.jobPosting.count({ where: { candidateId, offerReceivedAt: { gte: weekStartDate, lt: weekEnd } } }),
      prisma.trackedCalendarEvent.count({
        where: { candidateId, startTime: { gte: weekStartDate, lt: weekEnd }, dismissedAt: null },
      }),
      getNeedsFollowUpList(candidateId),
    ])

  return {
    outreachCount,
    applicationsCount,
    interviewsLandedCount,
    offersReceivedCount,
    calendarMeetingsCount,
    followUpsPendingCount: followUps.length,
  }
}
