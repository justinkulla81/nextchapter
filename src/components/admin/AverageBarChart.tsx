export interface BarSeries {
  label: string
  color: string // a CSS custom property reference, e.g. 'var(--color-brand)'
  buckets: { label: string; average: number }[]
}

const WIDTH = 640
const HEIGHT = 200
const PAD_X = 12
const PAD_LEFT = 34
const PAD_TOP = 16
const PAD_BOTTOM = 28

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

// Grouped vertical bars on one shared scale, hand-rolled SVG like
// VisitorsPerDayChart. `labelEvery` thins the x labels for the 24-hour charts.
export function AverageBarChart({
  series,
  labelEvery = 1,
  unit,
  emptyMessage,
}: {
  series: BarSeries[]
  labelEvery?: number
  unit: string
  emptyMessage?: string
}) {
  const buckets = series[0]?.buckets ?? []
  if (buckets.length === 0 || !series.some((s) => s.buckets.some((b) => b.average > 0))) {
    return <p className="text-sm text-muted-foreground">{emptyMessage ?? 'No activity in this window yet.'}</p>
  }

  const max = Math.max(0.1, ...series.flatMap((s) => s.buckets.map((b) => b.average)))
  const innerWidth = WIDTH - PAD_X - PAD_LEFT
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const slot = innerWidth / buckets.length
  const barWidth = (slot * 0.8) / series.length
  const yFor = (v: number) => PAD_TOP + innerHeight - (v / max) * innerHeight
  const grid = Array.from(new Set([0, max / 2, max]))

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={series.map((s) => `${s.label} ${unit}`).join(', ')}>
        {grid.map((v) => (
          <g key={v}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_X} y1={yFor(v)} y2={yFor(v)} stroke="var(--color-border)" strokeWidth={1} strokeDasharray={v === 0 ? undefined : '3 3'} />
            <text x={PAD_LEFT - 6} y={yFor(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--color-muted-foreground)">
              {trim(v)}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => (
          <g key={b.label}>
            {series.map((s, si) => {
              const v = s.buckets[i].average
              return (
                <rect
                  key={s.label}
                  x={PAD_LEFT + i * slot + slot * 0.1 + si * barWidth}
                  y={yFor(v)}
                  width={barWidth}
                  height={PAD_TOP + innerHeight - yFor(v)}
                  fill={s.color}
                >
                  <title>{`${b.label} — ${s.label}: ${v.toFixed(1)} ${unit}`}</title>
                </rect>
              )
            })}
            {i % labelEvery === 0 && (
              <text x={PAD_LEFT + i * slot + slot / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fill="var(--color-muted-foreground)">
                {b.label}
              </text>
            )}
          </g>
        ))}
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
