'use client'

import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { VisitorsPerDayChart, type ChartSeries } from './VisitorsPerDayChart'
import { useSharedTrafficRange, type TrafficRange } from './VisitorsActivityRange'

export interface SegmentChartLine {
  label: string
  color: string
  /** Dashed lines are the unique-visitor counts. */
  dashed?: boolean
  data: Record<TrafficRange, { key: string; count: number }[]>
}

const RANGES: { value: TrafficRange; label: string; blurb: string }[] = [
  { value: 'day', label: '1 day', blurb: 'Last 24 hours, by hour' },
  { value: '7d', label: '7 days', blurb: 'Last 7 days, by day' },
  { value: '30d', label: '30 days', blurb: 'Last 30 days, by day' },
  { value: 'all', label: 'All time', blurb: 'Since the first visit, by day' },
]

function formatDay(key: string, withYear = false): string {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) })
}

// Key is "YYYY-MM-DD HH" (ET).
function formatHour(key: string): string {
  const [date, hh] = key.split(' ')
  const h = Number(hh)
  return `${formatDay(date)} ${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`
}

// Several segments on one chart, each with a solid total and a dashed unique line. The range buttons are the
// same ones as the traffic chart above and move together with it (they share the page's range).
export function VisitorsSegmentChart({ chart, lines, emptyMessage }: { chart: string; lines: SegmentChartLine[]; emptyMessage: string }) {
  const shared = useSharedTrafficRange()
  const range = shared?.range ?? '30d'
  const current = RANGES.find((r) => r.value === range)!
  const series: ChartSeries[] = lines.map((l) => ({
    label: l.label,
    color: l.color,
    dashed: l.dashed,
    days: l.data[range].map((d) => ({ dateKey: d.key, count: d.count })),
  }))

  function choose(next: TrafficRange) {
    if (!shared || next === range) return
    posthog.capture('admin_visitors_chart_range_changed', { range: next, previous: range, chart })
    shared.setRange(next)
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-1" role="group" aria-label={`${chart} time range`}>
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => choose(r.value)}
              aria-pressed={r.value === range}
              className={cn(
                'rounded-md border px-3 py-1 text-sm',
                r.value === range ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-muted'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{current.blurb}, bots excluded. Solid lines are page views, dashed lines are unique visitors (one per IP).</span>
      </div>
      <VisitorsPerDayChart
        series={series}
        labelFor={range === 'day' ? formatHour : (k) => formatDay(k, range === 'all')}
        unitLabel={range === 'day' ? 'hour' : 'day'}
        emptyMessage={emptyMessage}
      />
    </div>
  )
}
