import type { ResumeFeedbackItem } from '@/lib/resume/analyze-resume'

// One card per {issue, action} pair — pairs "what a recruiter/hiring
// manager would notice" directly with the concrete fix, instead of two
// disconnected lists (feedback bullets vs. a separate action checklist).
export function ResumeFeedbackCard({ item }: { item: ResumeFeedbackItem }) {
  return (
    <div className="space-y-1.5 rounded-lg border border-border p-3">
      <p className="text-sm text-foreground">{item.issue}</p>
      <p className="text-sm font-medium text-foreground">
        <span className="text-muted-foreground">Fix: </span>
        {item.action}
      </p>
    </div>
  )
}
