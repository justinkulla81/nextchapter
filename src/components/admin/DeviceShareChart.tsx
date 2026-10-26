import type { DeviceClass } from '@/lib/http/device'

const DEVICES: { key: DeviceClass; color: string }[] = [
  { key: 'Mobile', color: 'var(--color-brand)' },
  { key: 'Desktop', color: 'var(--color-warning)' },
  { key: 'Tablet', color: 'var(--color-success, #16a34a)' },
  { key: 'Unknown', color: 'var(--color-muted-foreground, #9ca3af)' },
]

const WIDTH = 640
const HEIGHT = 180
const PAD_LEFT = 34
const PAD_RIGHT = 12
const PAD_TOP = 8
const PAD_BOTTOM = 24

function formatDayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// 100%-stacked column per day (share of that day's visitors by device) with an
// overall split bar above it. Days with no visitors draw nothing rather than a
// misleading empty 0% column.
export function DeviceShareChart({ days, overall }: { days: { dateKey: string; counts: Record<DeviceClass, number> }[]; overall: { label: string; count: number }[] }) {
  const total = overall.reduce((s, r) => s + r.count, 0)
  if (total === 0) return <p className="text-sm text-muted-foreground">No human visits in this window yet.</p>

  const inner = WIDTH - PAD_LEFT - PAD_RIGHT
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM
  const slot = inner / days.length
  const barW = Math.max(2, slot * 0.7)
  const present = DEVICES.filter((d) => overall.some((o) => o.label === d.key && o.count > 0))
  const labelEvery = Math.max(1, Math.ceil(days.length / 8))

  return (
    <div>
      <div className="mb-3 flex h-6 w-full overflow-hidden rounded" role="img" aria-label="Overall device split">
        {present.map((d) => {
          const n = overall.find((o) => o.label === d.key)?.count ?? 0
          const pct = (n / total) * 100
          return (
            <div key={d.key} style={{ width: `${pct}%`, background: d.color }} className="flex items-center justify-center text-[11px] font-medium text-white" title={`${d.key}: ${n} (${Math.round(pct)}%)`}>
              {pct >= 8 ? `${d.key} ${Math.round(pct)}%` : ''}
            </div>
          )
        })}
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Device share per day">
        {[0, 50, 100].map((v) => {
          const y = PAD_TOP + innerH - (v / 100) * innerH
          return (
            <g key={v}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.12} />
              <text x={PAD_LEFT - 6} y={y + 3} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.6}>{v}%</text>
            </g>
          )
        })}
        {days.map((d, i) => {
          const dayTotal = DEVICES.reduce((s, dev) => s + d.counts[dev.key], 0)
          const x = PAD_LEFT + i * slot + (slot - barW) / 2
          let yCursor = PAD_TOP + innerH
          return (
            <g key={d.dateKey}>
              {dayTotal > 0 &&
                DEVICES.map((dev) => {
                  const h = (d.counts[dev.key] / dayTotal) * innerH
                  if (h === 0) return null
                  yCursor -= h
                  return (
                    <rect key={dev.key} x={x} y={yCursor} width={barW} height={h} fill={dev.color}>
                      <title>{`${formatDayLabel(d.dateKey)} — ${dev.key}: ${d.counts[dev.key]} of ${dayTotal} (${Math.round((d.counts[dev.key] / dayTotal) * 100)}%)`}</title>
                    </rect>
                  )
                })}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.6}>{formatDayLabel(d.dateKey)}</text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
