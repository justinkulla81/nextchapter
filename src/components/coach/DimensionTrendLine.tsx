import { cn } from '@/lib/utils'
import { SESSION_DIMENSION_STATUS_LABEL, SESSION_DIMENSION_TREND_LABEL } from '@/lib/coach/session-dimensions'
import type { DimensionHistoryPoint } from '@/lib/coach/dimension-history'

const DOT_COLOR: Record<string, string> = {
  ON_TRACK: 'bg-success',
  AT_RISK: 'bg-warning',
  STALLED: 'bg-error',
}

const TREND_ARROW: Record<string, string> = {
  IMPROVING: '↑',
  STEADY: '→',
  DECLINING: '↓',
}

const TREND_COLOR: Record<string, string> = {
  IMPROVING: 'text-success',
  STEADY: 'text-muted-foreground',
  DECLINING: 'text-error',
}

// §A5.1 "each renders as a trend line" — deliberately not a charting
// library: a row of small status dots (one per tracked session, oldest to
// newest) plus the most recent trend arrow. Renders nothing but a plain
// "not tracked yet" line if this dimension has never been logged for this
// candidate.
export function DimensionTrendLine({ points }: { points: DimensionHistoryPoint[] }) {
  if (points.length === 0) {
    return <span className="text-xs text-muted-foreground">Not tracked yet</span>
  }

  const latest = points[points.length - 1]

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1" title="Status over recent sessions, oldest to newest">
        {points.map((p, i) => (
          <span
            key={i}
            className={cn('size-2.5 rounded-full', p.status ? DOT_COLOR[p.status] : 'bg-muted')}
            title={`${p.occurredAt.toLocaleDateString()}${p.status ? ` — ${SESSION_DIMENSION_STATUS_LABEL[p.status]}` : ''}`}
          />
        ))}
      </div>
      {latest.trend && (
        <span className={cn('text-xs font-medium', TREND_COLOR[latest.trend])}>
          {TREND_ARROW[latest.trend]} {SESSION_DIMENSION_TREND_LABEL[latest.trend]}
        </span>
      )}
    </div>
  )
}
