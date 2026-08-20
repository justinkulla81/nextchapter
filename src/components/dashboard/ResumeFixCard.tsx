import type { ResumeFixItem } from '@/lib/reports/market-reality-sections'

// Same itemized findings shown on the Market Reality Report's "What to fix
// on your resume" section, rendered here where the candidate can actually
// act on them. Read-only — fixing something now only happens through the
// Resume Fixer walkthrough, not a per-item "Mark as fixed" button here.
export function ResumeFixCard({ item }: { item: ResumeFixItem }) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{item.dimension}</p>
      <p className="text-sm text-foreground">{item.whatsWrong}</p>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Fix: </span>
        {item.fix}
      </p>
      {item.rewrite && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase">Before</p>
            <p className="mt-1 text-sm text-foreground">{item.rewrite.before}</p>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/5 p-3">
            <p className="text-xs font-medium text-success uppercase">After</p>
            <p className="mt-1 text-sm text-foreground">{item.rewrite.after}</p>
          </div>
        </div>
      )}
    </div>
  )
}
