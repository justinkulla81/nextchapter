interface DayCount {
  dateKey: string // YYYY-MM-DD, America/New_York
  count: number
}

const WIDTH = 640
const HEIGHT = 200
const PAD_X = 12
const PAD_TOP = 16
const PAD_BOTTOM = 28

function formatDayLabel(dateKey: string): string {
  // dateKey is an ET calendar day with no time component — parse as local
  // to avoid a UTC-parse shifting it back a day near midnight.
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Hand-rolled SVG, matching the existing MotivationChart/
// MarketRealityTrendChart convention — no charting library in this
// codebase yet, and one chart doesn't justify adding a new dependency.
export function VisitorsPerDayChart({ days }: { days: DayCount[] }) {
  if (days.length === 0 || days.every((d) => d.count === 0)) {
    return <p className="text-sm text-muted-foreground">No human visitor activity in this window yet.</p>
  }

  const maxCount = Math.max(1, ...days.map((d) => d.count))
  const innerWidth = WIDTH - PAD_X * 2
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const barGap = 2
  const barWidth = Math.max(1, innerWidth / days.length - barGap)
  const xFor = (i: number) => PAD_X + (i / days.length) * innerWidth
  const yFor = (count: number) => PAD_TOP + innerHeight - (count / maxCount) * innerHeight

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
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Human visitors per day">
      {gridValues.map((v) => (
        <line
          key={v}
          x1={PAD_X}
          x2={WIDTH - PAD_X}
          y1={yFor(v)}
          y2={yFor(v)}
          stroke="var(--color-border)"
          strokeWidth={1}
          strokeDasharray={v === 0 ? undefined : '3 3'}
        />
      ))}

      {days.map((d, i) => (
        <rect
          key={d.dateKey}
          x={xFor(i)}
          y={yFor(d.count)}
          width={barWidth}
          height={Math.max(0, yFor(0) - yFor(d.count))}
          fill="var(--color-brand)"
          rx={1}
        >
          <title>{`${formatDayLabel(d.dateKey)}: ${d.count} human visitor${d.count === 1 ? '' : 's'}`}</title>
        </rect>
      ))}

      {days.map(
        (d, i) =>
          labelIndices.has(i) && (
            <text
              key={`label-${d.dateKey}`}
              x={xFor(i) + barWidth / 2}
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
