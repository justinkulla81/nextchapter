export interface WarnMonthlyBar {
  /** "2026-01" */
  month: string
  label: string
  roles: number
  count: number
}

// Plain CSS bars, not a chart library — twelve data points don't need one,
// and this stays server-rendered with the rest of the page.
export function WarnMonthlyBarChart({ bars }: { bars: WarnMonthlyBar[] }) {
  const max = Math.max(1, ...bars.map((b) => b.roles))

  return (
    <div className="flex items-end gap-2" style={{ height: 160 }}>
      {bars.map((b) => (
        <div key={b.month} className="flex flex-1 flex-col items-center gap-1" title={`${b.label}: ${b.roles.toLocaleString()} roles across ${b.count} notices`}>
          <span className="text-xs tabular-nums text-muted-foreground">{b.roles > 0 ? b.roles.toLocaleString() : ''}</span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-brand/70"
              style={{ height: `${Math.max(2, (b.roles / max) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{b.label}</span>
        </div>
      ))}
    </div>
  )
}
