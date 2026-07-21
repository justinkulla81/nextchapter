import type { Grade } from '@/lib/scoring/grade'

// Same hand-rolled SVG pattern as MotivationChart — no charting library in
// this project. Plots Market Reality Grade (the "Hireability Score" trend,
// per Prompt 50) over the archived weekly snapshots from Prompt 46. Grades
// are ordinal (A-F), not a raw score — this reads them onto a 0-4 axis
// purely for line position, never displays a numeric score anywhere.
const GRADE_VALUE: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 }

const WIDTH = 640
const HEIGHT = 160
const PAD_X = 12
const PAD_TOP = 16
const PAD_BOTTOM = 24

export interface TrendSnapshot {
  weekStartDate: Date
  grade: Grade
}

function trendDirection(snapshots: TrendSnapshot[]): 'up' | 'down' | 'flat' | null {
  if (snapshots.length < 2) return null
  const first = GRADE_VALUE[snapshots[0].grade]
  const last = GRADE_VALUE[snapshots[snapshots.length - 1].grade]
  if (last > first) return 'up'
  if (last < first) return 'down'
  return 'flat'
}

const TREND_COPY: Record<'up' | 'down' | 'flat', { icon: string; label: string }> = {
  up: { icon: '↑', label: 'Trending up' },
  down: { icon: '↓', label: 'Trending down' },
  flat: { icon: '→', label: 'Holding steady' },
}

export function MarketRealityTrendChart({
  snapshots,
  emptyStateText = 'Your Market Reality Grade trend will show up here once a few weekly snapshots have been archived.',
  ariaLabel = 'Market Reality Grade over time',
}: {
  snapshots: TrendSnapshot[]
  emptyStateText?: string
  ariaLabel?: string
}) {
  if (snapshots.length < 2) {
    return <p className="text-sm text-muted-foreground">{emptyStateText}</p>
  }

  const innerWidth = WIDTH - PAD_X * 2
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const xFor = (i: number) => PAD_X + (i / (snapshots.length - 1)) * innerWidth
  const yFor = (value: number) => PAD_TOP + innerHeight - (value / 4) * innerHeight

  const linePath = snapshots
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(GRADE_VALUE[s.grade])}`)
    .join(' ')

  const direction = trendDirection(snapshots)
  const labelEvery = Math.max(1, Math.ceil(snapshots.length / 6))

  return (
    <div>
      {direction && (
        <p className="mb-2 text-sm font-medium text-foreground">
          {TREND_COPY[direction].icon} {TREND_COPY[direction].label}
        </p>
      )}
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={ariaLabel}>
        {(['F', 'D', 'C', 'B', 'A'] as Grade[]).map((g) => (
          <line
            key={g}
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={yFor(GRADE_VALUE[g])}
            y2={yFor(GRADE_VALUE[g])}
            stroke="var(--color-border)"
            strokeWidth={1}
            strokeDasharray={g === 'F' ? undefined : '3 3'}
          />
        ))}

        <path d={linePath} fill="none" stroke="var(--color-brand)" strokeWidth={2} />

        {snapshots.map((s, i) => (
          <circle key={i} cx={xFor(i)} cy={yFor(GRADE_VALUE[s.grade])} r={3.5} fill="var(--color-brand)">
            <title>
              Week of {s.weekStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: {s.grade}
            </title>
          </circle>
        ))}

        {snapshots.map(
          (s, i) =>
            (i === 0 || i === snapshots.length - 1 || i % labelEvery === 0) && (
              <text
                key={`label-${i}`}
                x={xFor(i)}
                y={HEIGHT - 6}
                textAnchor={i === 0 ? 'start' : i === snapshots.length - 1 ? 'end' : 'middle'}
                fontSize={10}
                fill="var(--color-muted-foreground)"
              >
                {s.weekStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            )
        )}
      </svg>
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>F</span>
        <span>A</span>
      </div>
    </div>
  )
}
