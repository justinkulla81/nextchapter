import type { Metadata } from 'next'
import { DashboardNav } from '@/components/dashboard/DashboardNav'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getSupportNetworkUnreadCount } from '@/lib/community/unread-count'
import { getCandidateUnreadCount } from '@/lib/messaging/threads'
import { getWatchlistNotificationCount } from '@/lib/company-tracker/watchlist'
import { isGmailTrackingTester } from '@/lib/email-tracking/gmail-oauth'
import { isCalendarTrackingTester } from '@/lib/calendar-tracking/google-calendar-oauth'
import { IdentifyUser } from '@/lib/posthog/IdentifyUser'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// The first-registration report generation + email (see get-dashboard-data.ts's
// after() block) and the on-demand resolveLatestReport() in page.tsx both run
// an Opus call plus market-data lookups in the background after the response
// is sent. after() callbacks share the SAME invocation's maxDuration as the
// initial render, not a separate budget, so this needs to be long enough for
// that background work to finish — not just long enough for the page itself.
// 300 is the actual ceiling on this project's plan (Hobby + Fluid Compute).
export const maxDuration = 300

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getDashboardData()

  const [
    narrativeCount,
    hasMarketReality,
    supportNetworkUnreadCount,
    messagesUnreadCount,
    newJobMatchesCount,
    watchlistNotificationCount,
  ] = await Promise.all([
    prisma.candidateNarrative.count({ where: { candidateId: profile.id } }),
    prisma.marketRealitySnapshot.count({ where: { candidateId: profile.id } }),
    getSupportNetworkUnreadCount(profile.id, profile.communityLastViewedAt),
    getCandidateUnreadCount(profile.id),
    // Unreacted automated-search-partner matches waiting for the candidate
    // to rate — the same queue find-my-job/page.tsx tops up to 5 on every
    // visit, so this is a real, already-tracked "new matches" signal
    // rather than a separate read/unread marker.
    prisma.surfacedJob.count({ where: { candidateId: profile.id, reaction: null } }),
    // Company Tracker (Prompt 77) — new postings from watched companies
    // since the candidate last viewed the page.
    getWatchlistNotificationCount(profile.id),
  ])

  // Each category counts once toward "assets you have" regardless of how
  // much history it holds — a resume with 4 versions or a Market Reality
  // Report with 10 weekly snapshots is still one current asset, not N.
  const portfolioAssetCount =
    (profile.resumes.length > 0 ? 1 : 0) +
    profile.jobPostings.filter((j) => !!j.coverLetter).length +
    narrativeCount +
    (profile.hireabilityReports.length > 0 ? 1 : 0) +
    (hasMarketReality > 0 ? 1 : 0) +
    profile.workSamples.length

  return (
    <div className="min-h-screen">
      <IdentifyUser candidateId={profile.id} email={profile.email} />
      <DashboardNav
        portfolioAssetCount={portfolioAssetCount}
        supportNetworkUnreadCount={supportNetworkUnreadCount}
        needsWorkStyleSurvey={profile.assessmentResponses.length === 0}
        messagesUnreadCount={messagesUnreadCount}
        newJobMatchesCount={newJobMatchesCount}
        watchlistNotificationCount={watchlistNotificationCount}
        showEmailActivity={profile.email ? isGmailTrackingTester(profile.email) : false}
        showCalendarActivity={profile.email ? isCalendarTrackingTester(profile.email) : false}
      />
      <main className="px-6 py-12 lg:pl-[calc(16rem+1.5rem)]">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  )
}
