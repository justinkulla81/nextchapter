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
  const now = new Date()
  const [
    { approvalsNeeded }, reportedMessages, communityModeration, needsCompletion, crmQueue, crmPeopleQueue,
    peopleTotal, orgsTotal, removedTotal, warnPending, activityReview,
  ] = await Promise.all([
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
    prisma.crmPerson.count({ where: { needsCompletion: true, deletedAt: null } }),
    // A rough count of what's overdue right now — a broken promise or a
    // missed next step — not the page's full snoozed/buffered query. Close
    // enough for "is there something waiting", which is all a badge needs to
    // answer.
    prisma.crmOpportunity.count({
      where: { outcome: 'OPEN', OR: [{ committedFollowUpAt: { lt: now } }, { nextStepDueAt: { lt: now } }] },
    }),
    // Same "is there something waiting" question, but the People queue no
    // longer has an "own next step" band — it's just overdue promises now,
    // whether that's a person-level follow-up (CrmPerson.nextFollowUpAt) or
    // an opportunity-level one (CrmOpportunity.committedFollowUpAt). The
    // page itself also shows every P0/P1 person, but that's a standing
    // list, not a "new since yesterday" count, so it's deliberately left
    // out of the badge the same way Org queue's badge excludes its own
    // "never touched" band.
    prisma.crmPerson.count({ where: { nextFollowUpAt: { lt: now }, deletedAt: null } }).then(async (personCount) => {
      const oppCount = await prisma.crmOpportunity.count({
        where: { outcome: 'OPEN', committedFollowUpAt: { lt: now }, primaryPersonId: { not: null }, primaryPerson: { deletedAt: null } },
      })
      return personCount + oppCount
    }),
    // Plain directory sizes — rendered as a gray "count" badge in the nav,
    // not the orange "needs action" one, since nothing here is waiting on
    // you. See AdminNav's badgeTone.
    prisma.crmPerson.count({ where: { deletedAt: null } }),
    prisma.crmOrganization.count(),
    prisma.crmPerson.count({ where: { deletedAt: { not: null } } }),
    // The one state on the Layoff notices page actually waiting on review —
    // mirrors that page's own default filter (status: 'pending').
    prisma.warnNotice.count({ where: { promotedAt: null, dismissedAt: null } }),
    prisma.crmActivity.count({ where: { needsReview: true, person: { deletedAt: null } } }),
  ])

  const badges = {
    jobBoard: approvalsNeeded.pendingJobBoardListings,
    bountyClaims: approvalsNeeded.pendingBountyClaims,
    referenceDisputes: approvalsNeeded.unresolvedReferenceDisputes,
    scholarshipApplications: approvalsNeeded.pendingScholarshipApplications,
    identityMatches: approvalsNeeded.pendingIdentityMatches,
    eqoveriqApplications: approvalsNeeded.pendingEqOverIqApplications,
    reportedMessages,
    communityModeration,
    crmQueue,
    crmPeopleQueue,
    peopleTotal,
    orgsTotal,
    removedTotal,
    warnPending,
    activityReview,
    // Job Board listings are their own review queue (shown on the Job Board
    // nav item above) and never appear as rows on the Requests page itself —
    // counting them here would double them into a badge for a list they
    // don't belong to.
    requests:
      approvalsNeeded.pendingBountyClaims +
      approvalsNeeded.unresolvedReferenceDisputes +
      approvalsNeeded.pendingIntroRequests,
    needsCompletion,
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
          className="lg:pl-[calc(var(--admin-nav-w,16rem)+1.5rem)]"
        />
        <main className="px-6 py-12 lg:pl-[calc(var(--admin-nav-w,16rem)+1.5rem)]">
          <div className="mx-auto max-w-[var(--admin-max-w,80rem)]">{children}</div>
        </main>
      </div>
    </div>
  )
}
