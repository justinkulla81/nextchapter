import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { getCoachMatchDistribution } from '@/lib/admin/coach-matches'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import type { CoachMatchSummary } from '@/lib/admin/coach-matches'

export const maxDuration = 30

// Flags imbalance (one coach absorbing most matches) for a human to look
// at — not an automated rebalancing action, per the matching design's
// Phase 1 scope at this coach-roster size.
const IMBALANCE_MULTIPLE = 2

export default async function AdminCoachMatchesPage() {
  await requireAdmin()
  const rows = await getCoachMatchDistribution()

  const total = rows.reduce((sum, r) => sum + r.clientCount, 0)
  const avg = rows.length > 0 ? total / rows.length : 0
  const imbalanced = avg > 0 ? rows.filter((r) => r.clientCount > avg * IMBALANCE_MULTIPLE) : []

  const columns: AdminColumn<CoachMatchSummary>[] = [
    {
      header: 'Coach',
      render: (r) => (
        <Link href={`/support/admin/coaches/${r.coachId}`} className="text-primary underline underline-offset-4">
          {r.fullName}
        </Link>
      ),
    },
    { header: 'Clients', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.clientCount },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coach Matches</h1>
        <p className="mt-1 text-muted-foreground">
          Current caseload distribution across coaches — a manual check for imbalance, not automated
          rebalancing.
        </p>
      </div>

      {imbalanced.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">
            {imbalanced.map((r) => r.fullName).join(', ')} {imbalanced.length > 1 ? 'have' : 'has'} more than{' '}
            {IMBALANCE_MULTIPLE}x the average caseload ({avg.toFixed(1)}) — worth a manual rebalance.
          </p>
        </div>
      )}

      <AdminDataTable columns={columns} rows={rows} rowKey={(r) => r.coachId} emptyMessage="No coaches yet." />
    </div>
  )
}
