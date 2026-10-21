import type { ResumeFixItem } from '@/lib/reports/market-reality-sections'

// Same itemized findings shown on the Market Reality Report's "What to fix
// on your resume" section, rendered here where the candidate can actually
// act on them. Read-only — fixing something now only happens through the
// Resume Fixer walkthrough, not a per-item "Mark as fixed" button here.
export function ResumeFixCard({ item }: { item: ResumeFixItem }) {
  return (
    <div className="space-y-2 p-5">
      <p className="text-base font-semibold text-ink">{item.whatsWrong}</p>
      <p className="text-base text-ink">
        <span className="font-semibold">Fix: </span>
        {item.fix}
      </p>
      <p className="text-sm text-muted-foreground">Affects your {item.dimension.toLowerCase()}.</p>
      {item.rewrite && (
        <div className="grid gap-3 pt-1 sm:grid-cols-2">
          <div className="space-y-1 rounded-xl bg-muted/60 p-4">
            <p className="text-sm font-semibold text-muted-foreground">Before</p>
            <p className="text-base text-ink">{item.rewrite.before}</p>
          </div>
          <div className="space-y-1 rounded-xl border border-ink p-4">
            <p className="text-sm font-semibold text-ink">After</p>
            <p className="text-base text-ink">{item.rewrite.after}</p>
          </div>
        </div>
      )}
    </div>
  )
}
