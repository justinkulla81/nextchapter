import { JOB_SOURCE_KINDS, type JobSourceKind } from '@/lib/admin/job-source'

const COLORS: Record<JobSourceKind, string> = {
  Direct: 'var(--color-success, #16a34a)',
  Jooble: 'var(--color-brand)',
  Adzuna: 'var(--color-warning)',
  USAJobs: '#7c3aed',
  'Other aggregator': 'var(--color-muted-foreground, #9ca3af)',
}

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

// 100%-stacked column per day (share of that day's job-page views by where the
// Apply link goes) with an overall split bar above it. Same shape as DeviceShareChart.
export function JobSourceShareChart({ days }: { days: { dateKey: string; counts: Record<JobSourceKind, number> }[] }) {
  const overall = JOB_SOURCE_KINDS.map((k) => ({ key: k, count: days.reduce((s, d) => s + d.counts[k], 0) }))
  const total = overall.reduce((s, r) => s + r.count, 0)
  if (total === 0) return <p className="text-sm text-muted-foreground">No job-page views in this window yet.</p>

  const inner = WIDTH - PAD_LEFT - PAD_RIGHT
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM
  const slot = inner / days.length
  const barW = Math.max(2, slot * 0.7)
  const labelEvery = Math.max(1, Math.ceil(days.length / 8))

  return (
    <div>
      <div className="mb-3 flex h-6 w-full overflow-hidden rounded" role="img" aria-label="Overall job source split">
        {overall.filter((o) => o.count > 0).map((o) => {
          const pct = (o.count / total) * 100
          return (
            <div key={o.key} style={{ width: `${pct}%`, background: COLORS[o.key] }} className="flex items-center justify-center text-[11px] font-medium text-white" title={`${o.key}: ${o.count} (${Math.round(pct)}%)`}>
              {pct >= 8 ? `${o.key} ${Math.round(pct)}%` : ''}
            </div>
          )
        })}
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Job source share per day">
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
          const dayTotal = JOB_SOURCE_KINDS.reduce((s, k) => s + d.counts[k], 0)
          const x = PAD_LEFT + i * slot + (slot - barW) / 2
          let yCursor = PAD_TOP + innerH
          return (
            <g key={d.dateKey}>
              {dayTotal > 0 &&
                JOB_SOURCE_KINDS.map((k) => {
                  const h = (d.counts[k] / dayTotal) * innerH
                  if (h === 0) return null
                  yCursor -= h
                  return (
                    <rect key={k} x={x} y={yCursor} width={barW} height={h} fill={COLORS[k]}>
                      <title>{`${formatDayLabel(d.dateKey)} — ${k}: ${d.counts[k]} of ${dayTotal} (${Math.round((d.counts[k] / dayTotal) * 100)}%)`}</title>
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
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {JOB_SOURCE_KINDS.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[k] }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  )
}
