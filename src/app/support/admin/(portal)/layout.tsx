import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminHomepageSummary } from '@/lib/admin/homepage-summary'
import { prisma } from '@/lib/prisma'
import { AdminNav } from '@/components/admin/AdminNav'
import { RoleContextBanner } from '@/components/auth/RoleContextBanner'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()
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
    scholarshipApplications: approvalsNeeded.pendingScholarshipApplications,
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
    <div className="theme-partner min-h-screen">
      <AdminNav badges={badges} />
      {/* pt-14 clears the fixed top bar — see CoachAppLayout's comment. */}
      <div className="pt-14">
        <RoleContextBanner
          userId={user.id}
          currentRole="nc_admin"
          personName={user.email ?? 'You'}
          className="lg:pl-[calc(16rem+1.5rem)]"
        />
        <main className="px-6 py-12 lg:pl-[calc(16rem+1.5rem)]">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
