import 'server-only'
import { prisma } from '@/lib/prisma'
import { getNeedsFollowUpList } from '@/lib/network/needs-follow-up'
import type { DeclineParty } from '@prisma/client'

export interface RejectedJobEntry {
  title: string | null
  companyName: string | null
  declinedAt: Date
  declinedBy: DeclineParty | null
}

// A job the candidate applied to (or is tracking) where they've flagged a
// contact from their own Support Network as able to help — see
// JobPosting.helpfulContacts (#710/#711, "Who can help"). Distinct from the
// automatic company-name backchannel match; this is candidate-confirmed.
export interface JobWithConnectionEntry {
  title: string | null
  companyName: string | null
  appliedAt: Date | null
  contactNames: string[]
}

// All-time job-search activity counts for a coach's Full Client View — the
// counterpart to getWeeklyOutcomes (weekly/outcomes.ts), which is week-scoped
// and built for the candidate-facing Weekly Focus card. A coach needs the
// whole arc of the search, not just this week, so this re-derives the same
// underlying counts without a date filter rather than looping
// getWeeklyOutcomes over every week the candidate has been active.
export interface JobActivityBreakdown {
  totalApplications: number
  totalRejections: number
  totalInterviewsLanded: number
  totalOffersReceived: number
  totalNetworkingOutreach: number
  totalCalendarMeetings: number
  // Real "follow-up sent" signal — a detected outbound thank-you or
  // follow-up email (see EmailActivityType), the same evidence
  // AUTO_DETECTED_ACTION_TYPES credits points for. Not a self-report.
  followUpsSentCount: number
  // "Currently owed," not "this week" — getNeedsFollowUpList is a lookback
  // window, same honesty caveat as WeeklyOutcomes.followUpsPendingCount.
  followUpsPendingCount: number
  // Simple deterministic ratios, not LLM-generated — the closest thing to
  // "context" a coach needs without adding a metered call to a view that can
  // be opened often. Null when there's no denominator yet.
  applicationToInterviewRate: number | null
  interviewToOfferRate: number | null
  rejectedJobs: RejectedJobEntry[]
  jobsWithConnections: JobWithConnectionEntry[]
}

export async function getJobActivityBreakdown(candidateId: string): Promise<JobActivityBreakdown> {
  const [
    totalApplications,
    totalInterviewsLanded,
    totalOffersReceived,
    totalNetworkingOutreach,
    totalCalendarMeetings,
    followUpsSentCount,
    followUpsPending,
    rejectedJobsRaw,
    jobsWithConnectionsRaw,
  ] = await Promise.all([
    prisma.jobPosting.count({ where: { candidateId, appliedAt: { not: null } } }),
    prisma.jobPosting.count({ where: { candidateId, interviewLandedAt: { not: null } } }),
    prisma.jobPosting.count({ where: { candidateId, offerReceivedAt: { not: null } } }),
    prisma.outreachLog.count({ where: { candidateId } }),
    prisma.trackedCalendarEvent.count({ where: { candidateId, dismissedAt: null } }),
    prisma.trackedEmailActivity.count({
      where: { candidateId, direction: 'OUTBOUND', activityType: { in: ['THANK_YOU', 'FOLLOW_UP'] } },
    }),
    getNeedsFollowUpList(candidateId),
    prisma.jobPosting.findMany({
      where: { candidateId, declinedAt: { not: null } },
      orderBy: { declinedAt: 'desc' },
      select: { title: true, companyName: true, declinedAt: true, declinedBy: true },
    }),
    prisma.jobPosting.findMany({
      where: { candidateId, helpfulContacts: { some: {} } },
      orderBy: { createdAt: 'desc' },
      select: { title: true, companyName: true, appliedAt: true, helpfulContacts: { select: { name: true } } },
    }),
  ])

  return {
    totalApplications,
    totalRejections: rejectedJobsRaw.length,
    totalInterviewsLanded,
    totalOffersReceived,
    totalNetworkingOutreach,
    totalCalendarMeetings,
    followUpsSentCount,
    followUpsPendingCount: followUpsPending.length,
    applicationToInterviewRate: totalApplications > 0 ? Math.round((totalInterviewsLanded / totalApplications) * 100) : null,
    interviewToOfferRate: totalInterviewsLanded > 0 ? Math.round((totalOffersReceived / totalInterviewsLanded) * 100) : null,
    // declinedAt is guaranteed non-null by the where filter above.
    rejectedJobs: rejectedJobsRaw.map((j) => ({ ...j, declinedAt: j.declinedAt! })),
    jobsWithConnections: jobsWithConnectionsRaw.map((j) => ({
      title: j.title,
      companyName: j.companyName,
      appliedAt: j.appliedAt,
      contactNames: j.helpfulContacts.map((c) => c.name),
    })),
  }
}
