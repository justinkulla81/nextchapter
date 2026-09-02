interface DayCount {
  dateKey: string // YYYY-MM-DD, America/New_York
  count: number
}

export interface ChartSeries {
  label: string
  days: DayCount[]
  color: string // a CSS custom property reference, e.g. 'var(--color-brand)'
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
// this codebase yet. Renders one or more series on a shared scale (a
// legend appears whenever there's more than one), so two related daily
// counts — e.g. human page views vs. unique visitors — can be compared
// directly on one chart instead of two separately-scaled ones.
export function VisitorsPerDayChart({ series, emptyMessage }: { series: ChartSeries[]; emptyMessage?: string }) {
  const days = series[0]?.days ?? []
  const hasAnyData = series.some((s) => s.days.some((d) => d.count > 0))

  if (days.length === 0 || !hasAnyData) {
    return <p className="text-sm text-muted-foreground">{emptyMessage ?? 'No activity in this window yet.'}</p>
  }

  const maxCount = Math.max(1, ...series.flatMap((s) => s.days.map((d) => d.count)))
  const innerWidth = WIDTH - PAD_X - PAD_LEFT
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const xFor = (i: number) => PAD_LEFT + (days.length === 1 ? innerWidth / 2 : (i / (days.length - 1)) * innerWidth)
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

  const ariaLabel = series.map((s) => `${s.label} per day`).join(', ')

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={ariaLabel}>
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

        {series.map((s) => {
          const linePath = s.days.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(d.count)}`).join(' ')
          return (
            <g key={s.label}>
              <path d={linePath} fill="none" stroke={s.color} strokeWidth={2} />
              {s.days.map((d, i) => (
                <circle key={d.dateKey} cx={xFor(i)} cy={yFor(d.count)} r={3} fill={s.color}>
                  <title>{`${formatDayLabel(d.dateKey)} — ${s.label}: ${d.count}`}</title>
                </circle>
              ))}
            </g>
          )
        })}

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

      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
