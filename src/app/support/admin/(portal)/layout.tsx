import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminHomepageSummary } from '@/lib/admin/homepage-summary'
import { prisma } from '@/lib/prisma'
import { AdminNav } from '@/components/admin/AdminNav'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  const [{ approvalsNeeded }, reportedMessages, communityModeration] = await Promise.all([
    getAdminHomepageSummary(),
    prisma.messageThread.count({ where: { partnerType: 'PEER', reportedAt: { not: null } } }),
    // Mirrors getModerationQueue's "needsReview" definition (moderation.ts)
    // without pulling post content — HELD posts plus unreviewed crisis
    // posts, §14's two highest-priority categories.
    prisma.communityPost.count({
      where: {
        OR: [{ moderationStatus: 'HELD' }, { moderationCategory: 'CRISIS_SELF_HARM', moderationReviewedAt: null }],
      },
    }),
  ])

  const badges = {
    jobBoard: approvalsNeeded.pendingJobBoardListings,
    bountyClaims: approvalsNeeded.pendingBountyClaims,
    referenceDisputes: approvalsNeeded.unresolvedReferenceDisputes,
    reportedMessages,
    communityModeration,
    // Job Board listings are their own review queue (shown on the Job Board
    // nav item above) and never appear as rows on the Requests page itself —
    // counting them here would double them into a badge for a list they
    // don't belong to.
    requests:
      approvalsNeeded.pendingBountyClaims +
      approvalsNeeded.unresolvedReferenceDisputes +
      approvalsNeeded.pendingIntroRequests,
  }

  return (
    <div className="min-h-screen">
      <AdminNav badges={badges} />
      <main className="px-6 py-12 lg:pl-[calc(16rem+1.5rem)]">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  )
}
