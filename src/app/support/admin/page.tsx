import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'

const ADMIN_PAGES = [
  { href: '/support/admin/candidates', label: 'Candidates', description: 'Browse and drill into any candidate.' },
  { href: '/support/admin/requests', label: 'Requests', description: 'Coaching, recruiter opt-ins, disputes, claims, intros.' },
  { href: '/support/admin/jobs', label: 'Jobs', description: 'Aggregate activity across tracked, surfaced, and board jobs.' },
  { href: '/support/admin/action-counts', label: 'Action Counts', description: 'Server-tracked event counts, filterable by segment and date.' },
  { href: '/support/admin/exclusive-jobs', label: 'Job Board', description: 'Review and approve pending listings.' },
  { href: '/support/admin/metrics', label: 'Pre-Seed Metrics', description: 'Live investor data-room metrics.' },
  { href: '/support/admin/bounty-claims', label: 'Offer Bonus Claims', description: 'Review candidate offer-bonus claims.' },
  { href: '/support/admin/layoff-cohorts', label: 'Layoff Cohorts', description: 'Manage cohorts and candidate matches.' },
  { href: '/support/admin/messages', label: 'Dashboard Messages', description: 'Edit the rotating candidate message set.' },
  { href: '/support/admin/recruiter-database', label: 'Recruiter Database', description: 'Candidates opted into recruiter visibility.' },
  { href: '/support/admin/reference-disputes', label: 'Reference Disputes', description: 'Resolve candidate-disputed references.' },
  { href: '/support/admin/employers', label: 'Hiring Managers', description: 'Employer accounts, roles posted, submissions.' },
  { href: '/support/admin/recruiters', label: 'Recruiters', description: 'Recruiter accounts and their job-board activity.' },
  { href: '/support/admin/coaches', label: 'Coaches', description: 'Coach accounts, clients, and session activity.' },
  { href: '/support/admin/research', label: 'Research Library', description: 'Ingested articles — triage, classify, and queue for the weekly digest.' },
  { href: '/support/admin/digest', label: 'Weekly Market Digest', description: 'Review the queue for the next send and see send history per audience.' },
  { href: '/support/admin/coach-matches', label: 'Coach Matches', description: 'Caseload distribution across coaches — a manual imbalance check.' },
]

export default async function AdminHomePage() {
  await requireAdmin()

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-muted-foreground">Internal tools — visible only to allowlisted admin accounts.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ADMIN_PAGES.map((page) => (
          <Link key={page.href} href={page.href} className="rounded-lg border border-border p-4 hover:border-primary">
            <p className="font-medium text-foreground">{page.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{page.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
