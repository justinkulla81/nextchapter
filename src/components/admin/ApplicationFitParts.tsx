import type { VerdictCounts, ApplyFitVerdict } from '@/lib/admin/application-fit'
import { VERDICT_LABEL } from '@/lib/admin/application-fit'
import { cn } from '@/lib/utils'

// Shared display pieces for the admin application-fit views (aggregate page
// and the candidate page card). Colors carry meaning, not action: reaching =
// warning, underselling = info-ish muted, on target = success.
export const VERDICT_TONE: Record<ApplyFitVerdict, string> = {
  reaching: 'bg-warning',
  on_target: 'bg-success',
  underselling: 'bg-sky-600',
  unknown: 'bg-muted-foreground/30',
}

/** Dot + label; text stays foreground-colored for contrast. */
export function VerdictBadge({ verdict }: { verdict: ApplyFitVerdict }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={cn('inline-block size-2 rounded-full', VERDICT_TONE[verdict])} aria-hidden />
      {VERDICT_LABEL[verdict]}
    </span>
  )
}

const pct = (n: number, d: number) => (d === 0 ? '—' : `${Math.round((n / d) * 100)}%`)

/** One stacked bar + legend: share of classified applications per verdict. */
export function VerdictShareBar({ counts, className }: { counts: VerdictCounts; className?: string }) {
  const known = counts.total - counts.unknown
  const parts: Exclude<ApplyFitVerdict, 'unknown'>[] = ['reaching', 'on_target', 'underselling']
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img"
        aria-label={parts.map((p) => `${VERDICT_LABEL[p]} ${pct(counts[p], known)}`).join(', ')}>
        {known > 0 && parts.map((p) => (
          <div key={p} className={VERDICT_TONE[p]} style={{ width: `${(counts[p] / known) * 100}%` }} />
        ))}
      </div>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {parts.map((p) => (
          <div key={p} className="flex items-center gap-2">
            <span className={cn('inline-block size-2 rounded-full', VERDICT_TONE[p])} aria-hidden />
            <dt className="text-muted-foreground">{VERDICT_LABEL[p]}</dt>
            <dd className="font-medium tabular-nums text-foreground">{pct(counts[p], known)}</dd>
            <dd className="tabular-nums text-muted-foreground">({counts[p]})</dd>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">Unknown</dt>
          <dd className="tabular-nums text-muted-foreground">{counts.unknown}</dd>
        </div>
      </dl>
    </div>
  )
}

/** Plain horizontal-bar histogram. */
export function Histogram({ rows, label }: { rows: { label: string; count: number }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <ul className="space-y-1 text-sm" aria-label={label}>
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2">
          <span className="text-muted-foreground">{r.label}</span>
          <span className="h-2 rounded-full bg-muted">
            <span className="block h-2 rounded-full bg-foreground/60" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-foreground">{r.count}</span>
        </li>
      ))}
    </ul>
  )
}
