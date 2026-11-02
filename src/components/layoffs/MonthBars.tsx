import type { MonthSummary } from '@/lib/layoffs/monthly'

// Bars for workers named in WARN notices, one per month. Plain SVG with inline styles so the same chart works on the
// site and inside other sites' iframes. Months with no named workers fall back to notice counts for the whole chart.
const W = 520
const H = 210
const TOP = 26
const BASE = 176

const short = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))

export function MonthBars({ months, label }: { months: MonthSummary[]; label: string }) {
  const useWorkers = months.some((m) => m.workers > 0)
  const values = months.map((m) => (useWorkers ? m.workers : m.count))
  const max = Math.max(1, ...values)
  const slot = W / Math.max(months.length, 1)
  const bar = Math.min(34, slot * 0.62)
  const summary = months.map((m, i) => `${m.name}: ${values[i].toLocaleString('en-US')}`).join('; ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}. ${useWorkers ? 'Workers named' : 'Notices'} by month. ${summary}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={0} x2={W} y1={BASE} y2={BASE} stroke="#d8dee8" />
      {months.map((m, i) => {
        const h = Math.round(((BASE - TOP) * values[i]) / max)
        const x = slot * i + (slot - bar) / 2
        const partial = i === months.length - 1
        return (
          <g key={m.slug}>
            <rect x={x} y={BASE - h} width={bar} height={Math.max(h, values[i] > 0 ? 2 : 0)} rx={3} fill="#1f5fbf" opacity={partial ? 0.55 : 1} />
            <text x={x + bar / 2} y={BASE - h - 6} textAnchor="middle" fontSize={11} fill="#14233a" style={{ fontVariantNumeric: 'tabular-nums' }}>{values[i] > 0 ? short(values[i]) : ''}</text>
            <text x={x + bar / 2} y={BASE + 16} textAnchor="middle" fontSize={11} fill="#5a6a80">{m.name.slice(0, 3)}</text>
          </g>
        )
      })}
    </svg>
  )
}
