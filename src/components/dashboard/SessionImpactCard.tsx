import type { SessionImpactReport } from '@/lib/coach/session-impact'
import { SessionRatingWidget } from '@/components/dashboard/SessionRatingWidget'

export function SessionImpactCard({ report }: { report: SessionImpactReport }) {
  return (
    <div className="space-y-2 rounded-lg border border-brand/30 bg-brand/5 p-4">
      <h2 className="text-sm font-medium text-foreground">Since your last coaching session</h2>
      <p className="text-sm text-foreground">{report.summary}</p>
      {report.directives && (
        <div className="border-t border-brand/20 pt-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            From your coach
          </p>
          <p className="mt-1 text-sm text-foreground">{report.directives}</p>
        </div>
      )}
      {report.showRatingPrompt && (
        <div className="border-t border-brand/20 pt-2">
          <SessionRatingWidget sessionId={report.sessionId} />
        </div>
      )}
    </div>
  )
}
