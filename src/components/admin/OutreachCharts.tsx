import type { Tally, WeekRow } from '@/lib/outreach/touch-stats'

const W = 720
const H = 220
const PAD = { top: 14, right: 44, bottom: 30, left: 40 }
/** A response rate from fewer touches than this is noise, so it is left off the chart. */
export const MIN_FOR_RATE = 5

const SERIES = [
  { key: 'automatedEmail', label: 'Automated email', color: 'var(--otr-1)' },
  { key: 'manualEmail', label: 'Email by hand', color: 'var(--otr-3)' },
  { key: 'calls', label: 'Calls', color: 'var(--otr-2)' },
  { key: 'linkedinText', label: 'LinkedIn and texts', color: 'var(--otr-4)' },
] as const

// Orange is left out on purpose: elsewhere in the CRM it means "from them".
const VIZ_CSS = `
  .otr-viz { --otr-1: #2a78d6; --otr-2: #1baf7a; --otr-3: #7c5cd6; --otr-4: #8892a0; --otr-grid: #e2e8f0; --otr-text: #4a5568; --otr-ink: #0a0a0a; }
  .dark .otr-viz { --otr-1: #3987e5; --otr-2: #199e70; --otr-3: #9378e0; --otr-4: #9aa3b0; --otr-grid: rgba(255,255,255,0.1); --otr-text: #a1a1a1; --otr-ink: #fafafa; }
`

function niceMax(v: number): number {
  if (v <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(v / 4))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s * 4 >= v) ?? pow * 10
  return step * 4
}

const shortWeek = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function Legend({ items }: { items: { label: string; color: string; dot?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden className={`inline-block ${i.dot ? 'h-2.5 w-2.5 rounded-full' : 'h-2.5 w-2.5 rounded-sm'}`} style={{ background: i.color }} />{i.label}
        </li>
      ))}
    </ul>
  )
}

/** Touches per week, stacked by kind, with the overall weekly target drawn across when one is set. */
export function WeeklyChart({ weeks, target }: { weeks: WeekRow[]; target: number | null }) {
  const n = weeks.length
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const yMax = niceMax(Math.max(1, target ?? 0, ...weeks.map((w) => w.total)))
  const slot = innerW / Math.max(1, n)
  const barW = Math.max(3, Math.min(32, slot * 0.7))
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH
  const labelEvery = Math.ceil(n / 8)
  return (
    <div className="otr-viz space-y-2">
      <style>{VIZ_CSS}</style>
      <Legend items={[...SERIES.map((s) => ({ label: s.label, color: s.color })), ...(target ? [{ label: `Weekly target (${target})`, color: 'var(--otr-ink)', dot: true }] : [])]} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Outreach touches per week by kind" className="h-auto w-full">
        {[0, 1, 2, 3, 4].map((i) => {
          const v = (yMax / 4) * i
          return <g key={i}><line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--otr-grid)" /><text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--otr-text)">{v}</text></g>
        })}
        {weeks.map((w, i) => {
          let top = 0
          const x = PAD.left + slot * (i + 0.5) - barW / 2
          return (
            <g key={w.week}>
              <title>{`Week of ${shortWeek(w.week)}: ${w.total} touches (${w.automatedEmail} automated email, ${w.manualEmail} email by hand, ${w.calls} calls, ${w.linkedinText} LinkedIn and texts), ${w.responded} responded`}</title>
              {SERIES.map((s) => {
                const v = w[s.key]
                if (!v) return null
                const y0 = y(top), y1 = y(top + v)
                top += v
                return <rect key={s.key} x={x} y={y1} width={barW} height={Math.max(1, y0 - y1)} fill={s.color} />
              })}
              {i % labelEvery === 0 && <text x={x + barW / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--otr-text)">{shortWeek(w.week)}</text>}
            </g>
          )
        })}
        {target ? <line x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} stroke="var(--otr-ink)" strokeDasharray="5 4" strokeWidth="1.5" /> : null}
      </svg>
    </div>
  )
}

/** Touches per bucket (an hour of the day or a weekday) as bars, with the response rate as a dot where there are enough touches to trust it. */
export function BucketChart({ buckets, labels, labelEvery = 1, ariaLabel, unit }: { buckets: Tally[]; labels: string[]; labelEvery?: number; ariaLabel: string; unit: string }) {
  const n = buckets.length
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const yMax = niceMax(Math.max(1, ...buckets.map((b) => b.sent)))
  const rates = buckets.map((b) => (b.sent >= MIN_FOR_RATE ? b.responded / b.sent : null))
  const rMax = Math.max(0.1, Math.ceil(Math.max(0, ...rates.map((r) => r ?? 0)) * 10) / 10)
  const slot = innerW / n
  const barW = Math.max(4, Math.min(26, slot * 0.7))
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH
  const yr = (r: number) => PAD.top + innerH - (r / rMax) * innerH
  const dots = rates.flatMap((r, i) => (r === null ? [] : [{ i, r }]))
  return (
    <div className="otr-viz space-y-2">
      <style>{VIZ_CSS}</style>
      <Legend items={[{ label: `${unit} sent`, color: 'var(--otr-1)' }, { label: `Response rate (shown with ${MIN_FOR_RATE}+ sent)`, color: 'var(--otr-ink)', dot: true }]} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="h-auto w-full">
        {[0, 1, 2, 3, 4].map((i) => {
          const v = (yMax / 4) * i
          return <g key={i}><line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--otr-grid)" /><text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--otr-text)">{v}</text><text x={W - PAD.right + 6} y={y(v) + 4} fontSize="11" fill="var(--otr-text)">{Math.round(((rMax / 4) * i) * 100)}%</text></g>
        })}
        {buckets.map((b, i) => {
          const x = PAD.left + slot * (i + 0.5) - barW / 2
          return (
            <g key={labels[i]}>
              <title>{`${labels[i]}: ${b.sent} sent, ${b.responded} responded${b.sent ? ` (${Math.round((100 * b.responded) / b.sent)}%)` : ''}`}</title>
              {b.sent > 0 && <rect x={x} y={y(b.sent)} width={barW} height={Math.max(1, y(0) - y(b.sent))} fill="var(--otr-1)" />}
              {i % labelEvery === 0 && <text x={x + barW / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--otr-text)">{labels[i]}</text>}
            </g>
          )
        })}
        {dots.length > 1 && <polyline fill="none" stroke="var(--otr-ink)" strokeOpacity="0.35" strokeWidth="1.5" points={dots.map((d) => `${PAD.left + slot * (d.i + 0.5)},${yr(d.r)}`).join(' ')} />}
        {dots.map((d) => <circle key={d.i} cx={PAD.left + slot * (d.i + 0.5)} cy={yr(d.r)} r="4" fill="var(--otr-ink)" />)}
      </svg>
    </div>
  )
}

/** Eight small bars for the last weeks against a target line, drawn beside a quota. */
export function Spark({ history, target }: { history: number[]; target: number }) {
  const max = Math.max(target, ...history, 1)
  const w = 8, gap = 3, h = 28
  return (
    <svg width={history.length * (w + gap)} height={h} role="img" aria-label={`Last ${history.length} weeks: ${history.join(', ')}, against a target of ${target}`}>
      {history.map((v, i) => <rect key={i} x={i * (w + gap)} y={h - Math.max(1, (v / max) * h)} width={w} height={Math.max(1, (v / max) * h)} rx="1" fill={v >= target ? 'var(--otr-2)' : 'var(--otr-4)'} opacity={i === history.length - 1 ? 0.5 : 1} />)}
      <line x1="0" x2={history.length * (w + gap)} y1={h - (target / max) * h} y2={h - (target / max) * h} stroke="var(--otr-ink)" strokeDasharray="3 2" />
    </svg>
  )
}
