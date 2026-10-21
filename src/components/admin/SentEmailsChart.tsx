'use client'

import { useEffect, useRef, useState } from 'react'

export interface SentDay {
  /** YYYY-MM-DD, Eastern time. */
  date: string
  cold: number
  crm: number
  gmail: number
  mailing: number
}

type Kind = 'cold' | 'crm' | 'gmail' | 'mailing'

// Orange is left out on purpose: elsewhere in the CRM it means "from them".
const KINDS: { key: Kind; label: string; color: string }[] = [
  { key: 'cold', label: 'Cold outreach', color: 'var(--sent-1)' },
  { key: 'mailing', label: 'Mailing list', color: 'var(--sent-2)' },
  { key: 'crm', label: 'Composed in CRM', color: 'var(--sent-3)' },
  { key: 'gmail', label: 'Sent from Gmail', color: 'var(--sent-4)' },
]

const total = (d: SentDay) => d.cold + d.crm + d.gmail + d.mailing
const HEIGHT = 240
const PAD = { top: 12, right: 12, bottom: 28, left: 40 }

function niceMax(v: number): number {
  if (v <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(v / 4))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s * 4 >= v) ?? pow * 10
  return step * 4
}

const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** Emails sent per day, stacked by kind. Hover or use the arrow keys to read one day; the same numbers are in the table below the chart. */
export function SentEmailsChart({ days }: { days: SentDay[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(720)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.floor(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = days.length
  const innerW = width - PAD.left - PAD.right
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const yMax = niceMax(Math.max(1, ...days.map(total)))
  const slot = innerW / Math.max(1, n)
  const barW = Math.max(2, Math.min(28, slot * 0.7))
  const cx = (i: number) => PAD.left + slot * (i + 0.5)
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH
  const ticks = [0, 1, 2, 3, 4].map((k) => (yMax / 4) * k)
  const xEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 70))))
  const used = KINDS.filter((k) => days.some((d) => d[k.key] > 0))

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    setActive(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * n))))
  }
  function onKey(e: React.KeyboardEvent<SVGSVGElement>) {
    if (e.key === 'ArrowLeft') { setActive((a) => Math.max(0, (a ?? n) - 1)); e.preventDefault() }
    if (e.key === 'ArrowRight') { setActive((a) => Math.min(n - 1, (a ?? -1) + 1)); e.preventDefault() }
    if (e.key === 'Escape') setActive(null)
  }

  const a = active !== null ? days[active] : null
  const tipLeft = active !== null ? (cx(active) > width / 2 ? cx(active) - 176 : cx(active) + 16) : 0

  return (
    <div className="sent-viz">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground" aria-hidden>
        {used.map((k) => (
          <span key={k.key} className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: k.color }} />{k.label}</span>
        ))}
      </div>

      <div ref={wrapRef} className="relative">
        <svg width={width} height={HEIGHT} role="img" tabIndex={0} onKeyDown={onKey}
          aria-label={`Emails sent per day by kind over the last ${n} days. Use left and right arrow keys to read each day.`}
          className="block outline-none focus-visible:ring-2 focus-visible:ring-brand">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--viz-text-muted)">{Math.round(t)}</text>
            </g>
          ))}
          {days.map((d, i) => (i % xEvery === 0 || i === n - 1) && (
            <text key={d.date} x={cx(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--viz-text-muted)">{shortDate(d.date)}</text>
          ))}
          {days.map((d, i) => {
            let base = 0
            return (
              <g key={d.date} opacity={active === null || active === i ? 1 : 0.45}>
                {KINDS.map((k) => {
                  const v = d[k.key]
                  if (!v) return null
                  const top = y(base + v), h = y(base) - top
                  base += v
                  return <rect key={k.key} x={cx(i) - barW / 2} y={top} width={barW} height={Math.max(1, h - 1)} rx={1} fill={k.color} />
                })}
              </g>
            )
          })}
          <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setActive(null)} />
        </svg>

        {a && (
          <div role="status" className="pointer-events-none absolute rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-sm" style={{ left: tipLeft, top: PAD.top }}>
            <p className="font-medium text-foreground">{new Date(`${a.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })} · {total(a)} sent</p>
            {KINDS.map((k) => (
              <p key={k.key} className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: k.color }} />{k.label}
                <span className="ml-auto pl-3 font-medium tabular-nums text-foreground">{a[k.key]}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show as table</summary>
        <table className="mt-2 w-full max-w-xl tabular-nums">
          <thead><tr className="text-left text-muted-foreground"><th className="py-1 font-medium">Day</th>{KINDS.map((k) => <th key={k.key} className="py-1 font-medium">{k.label}</th>)}<th className="py-1 font-medium">Total</th></tr></thead>
          <tbody>
            {[...days].reverse().map((d) => (
              <tr key={d.date} className="border-t border-border"><td className="py-1">{shortDate(d.date)}</td>{KINDS.map((k) => <td key={k.key} className="py-1">{d[k.key]}</td>)}<td className="py-1 font-medium">{total(d)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
      <style>{`
        .sent-viz { --sent-1: #2a78d6; --sent-2: #1baf7a; --sent-3: #7c5cd6; --sent-4: #8892a0; --viz-grid: #e2e8f0; --viz-text: #0a0a0a; --viz-text-muted: #4a5568; }
        .dark .sent-viz { --sent-1: #3987e5; --sent-2: #199e70; --sent-3: #9378e0; --sent-4: #9aa3b0; --viz-grid: rgba(255,255,255,0.1); --viz-text: #fafafa; --viz-text-muted: #a1a1a1; }
      `}</style>
    </div>
  )
}
