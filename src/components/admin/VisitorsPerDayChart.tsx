interface DayCount {
  dateKey: string // YYYY-MM-DD, America/New_York
  count: number
}

const WIDTH = 640
const HEIGHT = 200
const PAD_X = 12
const PAD_LEFT = 34 // room for the Y-axis value labels, in addition to PAD_X
const PAD_TOP = 16
const PAD_BOTTOM = 28

function formatDayLabel(dateKey: string): string {
  // dateKey is an ET calendar day with no time component — parse as local
  // to avoid a UTC-parse shifting it back a day near midnight.
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Hand-rolled SVG, matching the existing MotivationChart/
// MarketRealityTrendChart line-chart convention — no charting library in
// this codebase yet, and one chart doesn't justify adding a new dependency.
// Generic over what's being counted (page views, unique visitors, etc.) —
// callers pass a label used for the empty state, aria-label, and tooltips.
export function VisitorsPerDayChart({
  days,
  seriesLabel = 'visitor',
  emptyMessage,
}: {
  days: DayCount[]
  seriesLabel?: string
  emptyMessage?: string
}) {
  if (days.length === 0 || days.every((d) => d.count === 0)) {
    return <p className="text-sm text-muted-foreground">{emptyMessage ?? 'No activity in this window yet.'}</p>
  }

  const maxCount = Math.max(1, ...days.map((d) => d.count))
  const innerWidth = WIDTH - PAD_X - PAD_LEFT
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const xFor = (i: number) => PAD_LEFT + (days.length === 1 ? innerWidth / 2 : (i / (days.length - 1)) * innerWidth)
  const yFor = (count: number) => PAD_TOP + innerHeight - (count / maxCount) * innerHeight

  const linePath = days.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(d.count)}`).join(' ')

  const gridValues = Array.from(new Set([0, Math.round(maxCount / 2), maxCount]))
  // Evenly-spaced control points (always including both endpoints) rather
  // than a modulo step — a step-based "every Nth, plus force the last"
  // rule can land the last two labels one step apart and overlap when the
  // day count isn't evenly divisible by the step.
  const labelCount = Math.min(days.length, 8)
  const labelIndices = new Set(
    Array.from({ length: labelCount }, (_, i) => Math.round((i * (days.length - 1)) / Math.max(1, labelCount - 1)))
  )

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={`${seriesLabel}s per day`}>
      {gridValues.map((v) => (
        <line
          key={v}
          x1={PAD_LEFT}
          x2={WIDTH - PAD_X}
          y1={yFor(v)}
          y2={yFor(v)}
          stroke="var(--color-border)"
          strokeWidth={1}
          strokeDasharray={v === 0 ? undefined : '3 3'}
        />
      ))}

      {gridValues.map((v) => (
        <text
          key={`y-label-${v}`}
          x={PAD_LEFT - 6}
          y={yFor(v)}
          textAnchor="end"
          dominantBaseline="middle"
          fontSize={10}
          fill="var(--color-muted-foreground)"
        >
          {v}
        </text>
      ))}

      <path d={linePath} fill="none" stroke="var(--color-brand)" strokeWidth={2} />

      {days.map((d, i) => (
        <circle key={d.dateKey} cx={xFor(i)} cy={yFor(d.count)} r={3} fill="var(--color-brand)">
          <title>{`${formatDayLabel(d.dateKey)}: ${d.count} ${seriesLabel}${d.count === 1 ? '' : 's'}`}</title>
        </circle>
      ))}

      {days.map(
        (d, i) =>
          labelIndices.has(i) && (
            <text
              key={`label-${d.dateKey}`}
              x={xFor(i)}
              y={HEIGHT - 8}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-muted-foreground)"
            >
              {formatDayLabel(d.dateKey)}
            </text>
          )
      )}
    </svg>
  )
}
