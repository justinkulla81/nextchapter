import type { CurrentJobStatus } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { getActionCounts } from '@/lib/admin/action-counts'
import { CURRENT_JOB_STATUS_LABELS } from '@/lib/constants/onboarding'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'

export const maxDuration = 30

const RANGE_LABEL: Record<string, string> = {
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
}

function rangeToDate(range: string | undefined): Date | undefined {
  const days = range ? parseInt(range, 10) : NaN
  if (!Number.isFinite(days) || days <= 0) return undefined
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export default async function AdminActionCountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const rawParams = await searchParams
  const q = (rawParams.q ?? '').trim()
  const range = rawParams.range ?? ''
  const segment = rawParams.segment ?? ''

  const { total, rows } = await getActionCounts({
    q,
    from: rangeToDate(range),
    segment: segment ? (segment as CurrentJobStatus) : undefined,
  })

  const columns: AdminColumn<{ event: string; count: number }>[] = [
    { header: 'Event', render: (r) => r.event },
    { header: 'Count', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.count },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Action counts</h1>
        <p className="mt-1 text-muted-foreground">
          {total} server-tracked events matching the current filters. Client-side events aren&apos;t mirrored here yet.
        </p>
      </div>

      <AdminFilterBar
        basePath="/support/admin/action-counts"
        searchValue={q}
        searchPlaceholder="Search event name…"
        filters={[
          {
            key: 'range',
            label: 'Date range',
            value: range,
            options: Object.entries(RANGE_LABEL).map(([value, label]) => ({ value, label })),
          },
          {
            key: 'segment',
            label: 'Candidate segment',
            value: segment,
            options: Object.entries(CURRENT_JOB_STATUS_LABELS).map(([value, label]) => ({ value, label })),
          },
        ]}
      />

      <AdminDataTable columns={columns} rows={rows} rowKey={(r) => r.event} emptyMessage="No events match." />
    </div>
  )
}
