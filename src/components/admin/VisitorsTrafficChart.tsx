'use client'

import { useState } from 'react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { VisitorsPerDayChart, type ChartSeries } from './VisitorsPerDayChart'
import { useSharedTrafficRange, type TrafficRange } from './VisitorsActivityRange'

export type { TrafficRange }

export interface RangeSeries {
  pageViews: { key: string; count: number }[]
  uniqueVisitors: { key: string; count: number }[]
}

const RANGES: { value: TrafficRange; label: string; blurb: string }[] = [
  { value: 'day', label: '1 day', blurb: 'Last 24 hours, by hour' },
  { value: '7d', label: '7 days', blurb: 'Last 7 days, by day' },
  { value: '30d', label: '30 days', blurb: 'Last 30 days, by day' },
  { value: 'all', label: 'All time', blurb: 'Since the first visit, by day' },
]

function formatDay(key: string): string {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// All time can cross a year, so its labels carry the year.
function formatDayWithYear(key: string): string {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// Key is "YYYY-MM-DD HH" (ET).
function formatHour(key: string): string {
  const [date, hh] = key.split(' ')
  const h = Number(hh)
  return `${formatDay(date)} ${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`
}

// Adjacent buttons switch the window. Every range is computed on the server, so switching is instant and does not
// reload the page. Inside a TrafficRangeProvider the choice is shared with the count at the top of the page.
export function VisitorsTrafficChart({ data, allTimeTruncated = false }: { data: Record<TrafficRange, RangeSeries>; allTimeTruncated?: boolean }) {
  const shared = useSharedTrafficRange()
  const [localRange, setLocalRange] = useState<TrafficRange>('30d')
  const range = shared?.range ?? localRange
  const setRange = shared?.setRange ?? setLocalRange
  const current = RANGES.find((r) => r.value === range)!
  const series: ChartSeries[] = [
    { label: 'Human page views', days: data[range].pageViews.map((d) => ({ dateKey: d.key, count: d.count })), color: 'var(--color-brand)' },
    { label: 'Unique visitors', days: data[range].uniqueVisitors.map((d) => ({ dateKey: d.key, count: d.count })), color: 'var(--color-warning)' },
  ]

  function choose(next: TrafficRange) {
    if (next === range) return
    posthog.capture('admin_visitors_chart_range_changed', { range: next, previous: range })
    setRange(next)
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="inline-flex gap-1" role="group" aria-label="Chart time range">
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
        <span className="text-xs text-muted-foreground">
          {current.blurb}, bots excluded. Unique visitors is deduped by IP.
          {range === 'all' && allTimeTruncated ? ' Showing the most recent 200,000 events only.' : ''}
        </span>
      </div>
      <VisitorsPerDayChart
        series={series}
        labelFor={range === 'day' ? formatHour : range === 'all' ? formatDayWithYear : formatDay}
        unitLabel={range === 'day' ? 'hour' : 'day'}
        emptyMessage="No visitor activity in this window yet."
      />
    </div>
  )
}
