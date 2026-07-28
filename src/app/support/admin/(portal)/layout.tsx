import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminHomepageSummary } from '@/lib/admin/homepage-summary'
import { AdminNav } from '@/components/admin/AdminNav'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  const { approvalsNeeded } = await getAdminHomepageSummary()

  const badges = {
    jobBoard: approvalsNeeded.pendingJobBoardListings,
    bountyClaims: approvalsNeeded.pendingBountyClaims,
    referenceDisputes: approvalsNeeded.unresolvedReferenceDisputes,
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
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  )
}
