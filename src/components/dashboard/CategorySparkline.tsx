// Tiny hand-rolled SVG sparkline — same no-chart-library convention as
// MarketRealityTrendChart/MotivationChart. Deliberately unlabeled: the
// shape alone is the point (a flat line reads as flat), never a value.
const WIDTH = 72
const HEIGHT = 20
const PAD = 2

export function CategorySparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null

  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1
  const innerWidth = WIDTH - PAD * 2
  const innerHeight = HEIGHT - PAD * 2
  const xFor = (i: number) => PAD + (i / (scores.length - 1)) * innerWidth
  const yFor = (v: number) => PAD + innerHeight - ((v - min) / range) * innerHeight

  const path = scores.map((s, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(s)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT} aria-hidden="true">
      <path d={path} fill="none" stroke="var(--color-muted-foreground)" strokeWidth={1.5} />
    </svg>
  )
}
