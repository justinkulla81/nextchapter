import Link from 'next/link'
import { getAdminHomepageSummary } from '@/lib/admin/homepage-summary'

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function ApprovalRow({ href, label, count }: { href: string; label: string; count: number }) {
  if (count === 0) return null
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-border p-4 hover:border-primary"
    >
      <span className="font-medium text-foreground">{label}</span>
      <span className="rounded-full bg-orange/20 px-2.5 py-0.5 text-sm font-semibold text-orange tabular-nums">
        {count}
      </span>
    </Link>
  )
}

export default async function AdminHomePage() {
  const { approvalsNeeded, recentActivity, stats } = await getAdminHomepageSummary()

  const totalApprovals =
    approvalsNeeded.pendingJobBoardListings +
    approvalsNeeded.pendingBountyClaims +
    approvalsNeeded.unresolvedReferenceDisputes +
    approvalsNeeded.pendingIntroRequests

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-muted-foreground">Internal tools — visible only to allowlisted admin accounts.</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Needs your attention</h2>
        {totalApprovals === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing waiting on approval right now.</p>
        ) : (
          <div className="mt-3 space-y-2">
            <ApprovalRow
              href="/support/admin/exclusive-jobs"
              label="Job Board listings pending review"
              count={approvalsNeeded.pendingJobBoardListings}
            />
            <ApprovalRow
              href="/support/admin/bounty-claims"
              label="Offer Bonus claims pending review"
              count={approvalsNeeded.pendingBountyClaims}
            />
            <ApprovalRow
              href="/support/admin/reference-disputes"
              label="Reference disputes unresolved"
              count={approvalsNeeded.unresolvedReferenceDisputes}
            />
            <ApprovalRow
              href="/support/admin/requests"
              label="Job Board intro requests pending"
              count={approvalsNeeded.pendingIntroRequests}
            />
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Last 7 days</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <StatCard label="New candidate signups" value={recentActivity.newCandidateSignups} />
          <StatCard label="New Job Board listings" value={recentActivity.newJobBoardListings} />
          <StatCard label="New recruiter opt-ins" value={recentActivity.newRecruiterOptIns} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">At a glance</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <StatCard label="Total candidates" value={stats.totalCandidates} />
          <StatCard label="Registered candidates" value={stats.registeredCandidates} />
          <StatCard label="This week's Sprint Targets hit" value={stats.thisWeekSprintTargetCount} />
          <StatCard label="Coaches" value={stats.totalCoaches} />
          <StatCard label="Recruiters" value={stats.totalRecruiters} />
          <StatCard label="Hiring managers" value={stats.totalHiringManagers} />
          <StatCard label="Live Job Board listings" value={stats.liveJobBoardListings} />
        </div>
      </section>
    </div>
  )
}
