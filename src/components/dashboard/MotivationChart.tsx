import type { Mood } from '@prisma/client'
import { MOOD_LABEL, MOOD_SCORE } from '@/lib/daily/mood-labels'

interface Point {
  date: Date
  value: number
  label: string
  isBaseline?: boolean
}

const WIDTH = 640
const HEIGHT = 200
const PAD_X = 12
const PAD_TOP = 16
const PAD_BOTTOM = 28

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function MotivationChart({
  baseline,
  history,
}: {
  baseline: number | null
  history: { date: Date; mood: Mood }[]
}) {
  const points: Point[] = []
  if (baseline !== null) {
    points.push({ date: new Date(0), value: baseline, label: 'Starting point', isBaseline: true })
  }
  for (const entry of history) {
    points.push({ date: entry.date, value: MOOD_SCORE[entry.mood], label: MOOD_LABEL[entry.mood] })
  }

  if (points.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Check in on how you&apos;re feeling from the dashboard for a few days to see your trend here.
      </p>
    )
  }

  const innerWidth = WIDTH - PAD_X * 2
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const xFor = (i: number) => PAD_X + (points.length === 1 ? innerWidth / 2 : (i / (points.length - 1)) * innerWidth)
  const yFor = (value: number) => PAD_TOP + innerHeight - (value / 100) * innerHeight

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.value)}`).join(' ')

  // Thin out x-axis date labels so they don't overlap on longer histories.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6))

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Motivation over time">
        {[0, 10, 40, 70, 100].map((v) => (
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

        <path d={linePath} fill="none" stroke="var(--color-brand)" strokeWidth={2} />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(p.value)}
            r={p.isBaseline ? 4 : 3.5}
            fill={p.isBaseline ? 'var(--color-muted-foreground)' : 'var(--color-brand)'}
          >
            <title>{`${p.isBaseline ? 'Starting point (from your Market Reality Assessment)' : formatDate(p.date)}: ${p.label}`}</title>
          </circle>
        ))}

        {points.map(
          (p, i) =>
            (i === 0 || i === points.length - 1 || i % labelEvery === 0) && (
              <text
                key={`label-${i}`}
                x={xFor(i)}
                y={HEIGHT - 8}
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                fontSize={10}
                fill="var(--color-muted-foreground)"
              >
                {p.isBaseline ? 'Start' : formatDate(p.date)}
              </text>
            )
        )}
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Stuck</span>
        <span>Fired up</span>
      </div>
    </div>
  )
}
