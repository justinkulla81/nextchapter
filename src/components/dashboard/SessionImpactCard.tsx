import type { SessionImpactReport } from '@/lib/coach/session-impact'

export function SessionImpactCard({ report }: { report: SessionImpactReport }) {
  return (
    <div className="space-y-2 rounded-lg border border-brand/30 bg-brand/5 p-4">
      <h2 className="text-sm font-medium text-foreground">Since your last coaching session</h2>
      <p className="text-sm text-foreground">{report.summary}</p>
    </div>
  )
}
