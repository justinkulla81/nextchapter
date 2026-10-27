import type { Bucket } from '@/lib/admin/applied-jobs-breakdown'

// A ranked list with a bar behind each count. The numbers are text, so the bar is decoration only.
export function BreakdownBars({ title, hint, buckets, limit = 8 }: { title: string; hint?: string; buckets: Bucket[]; limit?: number }) {
  const shown = buckets.slice(0, limit)
  const rest = buckets.slice(limit).reduce((sum, b) => sum + b.applies, 0)
  const total = buckets.reduce((sum, b) => sum + b.applies, 0)
  const max = Math.max(1, ...shown.map((b) => b.applies))

  return (
    <div className="rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {shown.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No applies in this range yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {shown.map((b) => (
            <li key={b.label} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-foreground">{b.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {b.applies} · {Math.round((b.applies / total) * 100)}%
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden="true">
                <div className="h-1.5 rounded-full bg-muted-foreground" style={{ width: `${(b.applies / max) * 100}%` }} />
              </div>
            </li>
          ))}
          {rest > 0 && <li className="text-xs text-muted-foreground">Plus {rest} more in smaller groups</li>}
        </ul>
      )}
    </div>
  )
}
