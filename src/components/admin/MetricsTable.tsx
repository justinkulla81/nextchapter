import { cn } from '@/lib/utils'
import type { MetricRow } from '@/lib/admin/metrics'

function formatValue(row: MetricRow): string {
  if (row.value === null) return '—'
  if (row.format === 'percent') return `${row.value}%`
  if (row.format === 'days') return `${row.value} day${row.value === 1 ? '' : 's'}`
  if (row.format === 'grade') return String(row.value)
  return String(row.value)
}

function formatTarget(row: MetricRow): string {
  if (row.target === null) return '—'
  if (row.format === 'percent') return `>${row.target}%`
  return String(row.target)
}

const TREND_ICON: Record<MetricRow['trend'], string> = {
  up: '↑',
  down: '↓',
  flat: '→',
  unknown: '–',
}

const STATUS_LABEL: Record<MetricRow['status'], string> = {
  meeting: '✓ Meeting target',
  below: '⚠ Below target',
  far_below: '🔴 Significantly below',
  no_target: '—',
  not_tracked: 'Not yet tracked',
  no_data: 'No eligible cohort yet',
}

const STATUS_STYLE: Record<MetricRow['status'], string> = {
  meeting: 'text-success',
  below: 'text-warning',
  far_below: 'text-error',
  no_target: 'text-muted-foreground',
  not_tracked: 'text-muted-foreground italic',
  no_data: 'text-muted-foreground italic',
}

export function MetricsTable({ title, rows }: { title: string; rows: MetricRow[] }) {
  return (
    <div>
      <h2 className="text-xs font-semibold tracking-widest text-brand uppercase">{title}</h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Metric</th>
              <th className="px-4 py-2 font-medium">Current</th>
              <th className="px-4 py-2 font-medium">Target</th>
              <th className="px-4 py-2 font-medium">Trend</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-foreground">{row.label}</td>
                <td className="px-4 py-2 font-semibold tabular-nums text-foreground">{formatValue(row)}</td>
                <td className="px-4 py-2 tabular-nums text-muted-foreground">{formatTarget(row)}</td>
                <td className="px-4 py-2 text-muted-foreground">{TREND_ICON[row.trend]}</td>
                <td className={cn('px-4 py-2 font-medium', STATUS_STYLE[row.status])}>
                  {STATUS_LABEL[row.status]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
