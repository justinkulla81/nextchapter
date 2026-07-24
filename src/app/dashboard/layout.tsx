import type { Metadata } from 'next'
import { DashboardNav } from '@/components/dashboard/DashboardNav'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getSupportNetworkUnreadCount } from '@/lib/community/unread-count'
import { getCandidateUnreadCount } from '@/lib/messaging/threads'
import { IdentifyUser } from '@/lib/posthog/IdentifyUser'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// The first-registration report generation + email (see get-dashboard-data.ts's
// `after()` block) runs an LLM call plus an email send in the background after
// the response is sent — comfortably past the platform's default function
// duration, which was silently truncating it before the email ever went out.
export const maxDuration = 60

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getDashboardData()

  const [narrativeCount, hasMarketReality, supportNetworkUnreadCount, messagesUnreadCount] = await Promise.all([
    prisma.candidateNarrative.count({ where: { candidateId: profile.id } }),
    prisma.marketRealitySnapshot.count({ where: { candidateId: profile.id } }),
    getSupportNetworkUnreadCount(profile.id, profile.communityLastViewedAt),
    getCandidateUnreadCount(profile.id),
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
      />
      <main className="px-6 py-12 lg:pl-[calc(16rem+1.5rem)]">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  )
}
