import type { TimelineChart } from '@/lib/reports/market-reality-brief/experience'
import type { ProfileGroup } from '@/lib/reports/market-reality-brief/profile'
import { ADEQUATE_AT, STRENGTH_AT } from '@/lib/reports/market-reality-brief/profile'
import type { EffortPlan } from '@/lib/reports/market-reality-brief/effort-plan'

// Three small, single-ink charts. Navy on white, no color coding, no raw scores
// printed: the shape carries the message and the words next to it carry the
// meaning. Each has a text alternative.

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Roles as bars on a year axis; gaps of three months or more as hatched bands. */
export function CareerTimeline({ chart, id = 'tl' }: { chart: TimelineChart; id?: string }) {
  if (chart.bars.length === 0) return null
  const bars = [...chart.bars].sort((a, b) => b.start - a.start).slice(0, 9)
  const from = Math.min(...bars.map((b) => b.start), ...chart.gaps.map((g) => g.start))
  const to = chart.to
  const W = 720
  const left = 190
  const right = 14
  const rowH = 20
  const top = 22
  const H = top + bars.length * rowH + 22
  const x = (t: number) => left + ((t - from) / Math.max(1, to - from)) * (W - left - right)
  const y0 = new Date(from).getUTCFullYear()
  const y1 = new Date(to).getUTCFullYear()
  const step = y1 - y0 > 22 ? 5 : y1 - y0 > 10 ? 2 : 1
  const ticks: number[] = []
  for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) ticks.push(y)
  const summary = `Career timeline: ${bars.length} roles from ${y0} to ${y1}${chart.gaps.length > 0 ? `, with ${chart.gaps.length} gap${chart.gaps.length === 1 ? '' : 's'} of three months or more` : ', with no gaps of three months or more'}.`
  return (
    <figure className="break-inside-avoid">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="w-full text-navy">
        <defs>
          <pattern id={`${id}-hatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeWidth="1" opacity="0.45" />
          </pattern>
        </defs>
        {ticks.map((t) => {
          const tx = x(Date.UTC(t, 0, 1))
          return (
            <g key={t}>
              <line x1={tx} x2={tx} y1={top - 6} y2={H - 18} stroke="currentColor" strokeOpacity="0.12" />
              <text x={tx} y={top - 10} fontSize="9" textAnchor="middle" fill="currentColor" fillOpacity="0.6">{t}</text>
            </g>
          )
        })}
        {chart.gaps.map((g, i) => (
          <g key={i}>
            <rect x={x(g.start)} y={top - 4} width={Math.max(2, x(g.end) - x(g.start))} height={bars.length * rowH + 4} fill={`url(#${id}-hatch)`} />
            {g.months >= 6 && (
              <text x={(x(g.start) + x(g.end)) / 2} y={H - 6} fontSize="9" textAnchor="middle" fill="currentColor">{g.months} mo gap</text>
            )}
          </g>
        ))}
        {bars.map((b, i) => {
          const by = top + i * rowH
          const w = Math.max(3, x(b.end) - x(b.start))
          return (
            <g key={`${b.label}-${b.start}`}>
              <text x={left - 8} y={by + 11} fontSize="10" textAnchor="end" fill="currentColor">{short(`${b.title}, ${b.label}`, 34)}</text>
              <rect x={x(b.start)} y={by + 2} width={w} height="12" rx="1.5" fill="currentColor" fillOpacity={b.contract ? 0.3 : 1} stroke="currentColor" strokeWidth={b.contract ? 1 : 0} />
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-1 text-xs text-muted-foreground">
        Solid bars are roles; paler bars are interim, fractional or consulting work; hatched bands are gaps of three months or more.
      </figcaption>
    </figure>
  )
}

/** Each resume dimension as a position on a scale, with the two rating thresholds marked. No numbers. */
export function ProfileScale({ groups }: { groups: ProfileGroup[] }) {
  const rows = groups.flatMap((g) => g.rows)
  if (rows.length === 0) return null
  const W = 720
  const left = 200
  const right = 24
  const rowH = 19
  const top = 24
  const H = top + rows.length * rowH + 6
  const x = (v: number) => left + (v / 100) * (W - left - right)
  return (
    <figure className="break-inside-avoid">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Competency scale for ${rows.length} dimensions: ${rows.map((r) => r.label).join(', ')}.`} className="w-full text-navy">
        <text x={x(ADEQUATE_AT)} y="12" fontSize="9" textAnchor="middle" fill="currentColor" fillOpacity="0.65">Adequate</text>
        <text x={x(STRENGTH_AT)} y="12" fontSize="9" textAnchor="middle" fill="currentColor" fillOpacity="0.65">Strength</text>
        <line x1={x(ADEQUATE_AT)} x2={x(ADEQUATE_AT)} y1="16" y2={H - 2} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="2 3" />
        <line x1={x(STRENGTH_AT)} x2={x(STRENGTH_AT)} y1="16" y2={H - 2} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="2 3" />
        {rows.map((r, i) => {
          const ry = top + i * rowH
          return (
            <g key={r.key}>
              <text x={left - 10} y={ry + 10} fontSize="10" textAnchor="end" fill="currentColor">{short(r.label, 32)}</text>
              <line x1={x(0)} x2={x(100)} y1={ry + 7} y2={ry + 7} stroke="currentColor" strokeOpacity="0.12" />
              <rect x={x(0)} y={ry + 3} width={x(r.score) - x(0)} height="8" rx="1" fill="currentColor" fillOpacity={r.assessment === 'development' ? 0.35 : r.assessment === 'adequate' ? 0.6 : 1} />
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-1 text-xs text-muted-foreground">Darker bars rate higher. The dashed lines mark where a dimension becomes adequate and where it becomes a strength.</figcaption>
    </figure>
  )
}

/** Weekly activity the market calls for, against what the member does now. */
export function PaceBars({ plan }: { plan: EffortPlan }) {
  const b = plan.routes.find((r) => r.key === 'balanced')
  if (!b) return null
  const rows = [
    { label: 'Applications a week', need: b.applicationsPerWeek, have: plan.pace.applicationsPerWeek },
    { label: 'Conversations a week', need: b.conversationsPerWeek, have: plan.pace.conversationsPerWeek },
  ]
  const max = Math.max(1, ...rows.flatMap((r) => [r.need, r.have]))
  const W = 720
  const left = 170
  const x = (v: number) => left + (v / max) * (W - left - 60)
  return (
    <figure className="break-inside-avoid">
      <svg viewBox={`0 0 ${W} 74`} role="img" aria-label={rows.map((r) => `${r.label}: ${r.have} now, ${r.need} needed`).join('. ')} className="w-full text-navy">
        {rows.map((r, i) => {
          const ry = 8 + i * 32
          return (
            <g key={r.label}>
              <text x={left - 10} y={ry + 14} fontSize="10" textAnchor="end" fill="currentColor">{r.label}</text>
              <rect x={left} y={ry} width={Math.max(1, x(r.need) - left)} height="10" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
              <rect x={left} y={ry + 12} width={Math.max(1, x(r.have) - left)} height="10" fill="currentColor" />
              <text x={x(r.need) + 6} y={ry + 9} fontSize="9" fill="currentColor">{r.need} needed</text>
              <text x={x(r.have) + 6} y={ry + 21} fontSize="9" fill="currentColor">{r.have} now</text>
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-1 text-xs text-muted-foreground">Dashed outline: the balanced route in the table above. Solid: your last four weeks.</figcaption>
    </figure>
  )
}
