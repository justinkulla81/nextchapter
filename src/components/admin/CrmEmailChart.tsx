'use client'

import { useEffect, useRef, useState } from 'react'

export interface EmailDay {
  /** YYYY-MM-DD, in the admin's timezone. */
  date: string
  sent: number
  received: number
}

const SERIES = [
  { key: 'sent', label: 'Sent', color: 'var(--viz-series-1)' },
  { key: 'received', label: 'Received', color: 'var(--viz-series-2)' },
] as const

const HEIGHT = 220
const PAD = { top: 12, right: 72, bottom: 28, left: 36 }

// Four gridline steps, each a round number, and the smallest such top that
// clears the peak — a 131 peak gets 200, not 400.
function niceMax(v: number): number {
  if (v <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(v / 4))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s * 4 >= v) ?? pow * 10
  return step * 4
}

function shortDate(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * Emails per day, sent against received.
 *
 * Two lines on one axis — both are counts of the same thing, so one scale is
 * honest. Series use the first two slots of the validated categorical palette
 * (blue, orange; worst colorblind separation ΔE 24.7 light / 26.8 dark), and
 * each line is also labelled at its end, so identity never rests on colour.
 * Hover or arrow keys move a crosshair that reads out both values for a day;
 * the same numbers are one click away as a table.
 */
export function CrmEmailChart({ days }: { days: EmailDay[] }) {
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
  const yMax = niceMax(Math.max(1, ...days.map((d) => Math.max(d.sent, d.received))))
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH
  const ticks = [0, 1, 2, 3, 4].map((k) => (yMax / 4) * k)
  const xEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 90))))

  const path = (key: 'sent' | 'received') =>
    days.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ')

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const i = Math.round((px / rect.width) * (n - 1))
    setActive(Math.min(n - 1, Math.max(0, i)))
  }

  function onKey(e: React.KeyboardEvent<SVGSVGElement>) {
    if (e.key === 'ArrowLeft') { setActive((a) => Math.max(0, (a ?? n) - 1)); e.preventDefault() }
    if (e.key === 'ArrowRight') { setActive((a) => Math.min(n - 1, (a ?? -1) + 1)); e.preventDefault() }
    if (e.key === 'Escape') setActive(null)
  }

  const last = days[n - 1]
  const a = active !== null ? days[active] : null
  // Keep the tooltip inside the plot: flip it to the left of the crosshair
  // past the midpoint.
  const tipLeft = active !== null ? (x(active) > width / 2 ? x(active) - 148 : x(active) + 12) : 0

  // End labels sit at each line's last value; nudge apart if they'd collide.
  const endY = { sent: last ? y(last.sent) : 0, received: last ? y(last.received) : 0 }
  if (Math.abs(endY.sent - endY.received) < 14) {
    const mid = (endY.sent + endY.received) / 2
    const up = last && last.sent >= last.received ? 'sent' : 'received'
    endY[up] = mid - 7
    endY[up === 'sent' ? 'received' : 'sent'] = mid + 7
  }

  return (
    <div className="viz-root">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground" aria-hidden>
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div ref={wrapRef} className="relative">
        <svg
          width={width} height={HEIGHT} role="img" tabIndex={0} onKeyDown={onKey}
          aria-label={`Emails per day over the last ${n} days. Use left and right arrow keys to read each day.`}
          className="block outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--viz-text-muted)">
                {Math.round(t)}
              </text>
            </g>
          ))}

          {days.map((d, i) => (i % xEvery === 0 || i === n - 1) && (
            <text key={d.date} x={x(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--viz-text-muted)">
              {shortDate(d.date)}
            </text>
          ))}

          {SERIES.map((s) => (
            <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {last && SERIES.map((s) => (
            <text key={s.key} x={width - PAD.right + 8} y={endY[s.key]} dy="0.32em" fontSize={11}
              fill="var(--viz-text)">
              {s.label} {last[s.key]}
            </text>
          ))}

          {active !== null && (
            <g pointerEvents="none">
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--viz-crosshair)" strokeWidth={1} />
              {SERIES.map((s) => (
                <circle key={s.key} cx={x(active)} cy={y(days[active][s.key])} r={4.5}
                  fill={s.color} stroke="var(--viz-surface)" strokeWidth={2} />
              ))}
            </g>
          )}

          {/* Hit area bigger than the lines: the whole plot. */}
          <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} fill="transparent"
            onMouseMove={onMove} onMouseLeave={() => setActive(null)} />
        </svg>

        {a && (
          <div
            role="status"
            className="pointer-events-none absolute rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-sm"
            style={{ left: tipLeft, top: PAD.top }}
          >
            <p className="font-medium text-foreground">
              {new Date(`${a.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
            </p>
            {SERIES.map((s) => (
              <p key={s.key} className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label} <span className="ml-auto pl-3 font-medium tabular-nums text-foreground">{a[s.key]}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show as table</summary>
        <table className="mt-2 w-full max-w-sm tabular-nums">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-medium">Day</th>
              <th className="py-1 text-right font-medium">Sent</th>
              <th className="py-1 text-right font-medium">Received</th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((d) => (
              <tr key={d.date} className="border-t border-border">
                <td className="py-1">{shortDate(d.date)}</td>
                <td className="py-1 text-right">{d.sent}</td>
                <td className="py-1 text-right">{d.received}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <style>{`
        .viz-root {
          --viz-series-1: #2a78d6;
          --viz-series-2: #eb6834;
          --viz-grid: #e2e8f0;
          --viz-crosshair: #94a3b8;
          --viz-text: #0a0a0a;
          --viz-text-muted: #4a5568;
          --viz-surface: #ffffff;
        }
        .dark .viz-root {
          --viz-series-1: #3987e5;
          --viz-series-2: #d95926;
          --viz-grid: rgba(255, 255, 255, 0.1);
          --viz-crosshair: rgba(255, 255, 255, 0.35);
          --viz-text: #fafafa;
          --viz-text-muted: #a1a1a1;
          --viz-surface: #252525;
        }
      `}</style>
    </div>
  )
}
