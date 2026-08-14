import { Check } from 'lucide-react'
import type { ResumeFeedbackItem } from '@/lib/resume/analyze-resume'
import { markResumeFixApplied } from '@/app/dashboard/resume/actions'
import { SubmitButton } from '@/components/ui/submit-button'

// One card per {issue, action} pair — pairs "what a recruiter/hiring
// manager would notice" directly with the concrete fix, instead of two
// disconnected lists (feedback bullets vs. a separate action checklist).
//
// `applied` backs the §12 "Fix three things on your resume" activation
// item — item.issue is this feedback item's stable key (see
// resumeFixesAppliedKeys's own comment in schema.prisma). Once marked, the
// card shows a plain checked state rather than a still-clickable button —
// there's nothing more to do with an already-fixed item.
export function ResumeFeedbackCard({ item, applied }: { item: ResumeFeedbackItem; applied: boolean }) {
  return (
    <div className="space-y-1.5 rounded-lg border border-border p-3">
      <p className="text-sm text-foreground">{item.issue}</p>
      <p className="text-sm font-medium text-foreground">
        <span className="text-muted-foreground">Fix: </span>
        {item.action}
      </p>
      <div className="pt-1">
        {applied ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-success">
            <Check className="size-3.5" aria-hidden />
            Marked as fixed
          </p>
        ) : (
          <form action={markResumeFixApplied.bind(null, item.issue)}>
            <SubmitButton variant="outline" size="sm">
              Mark as fixed
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  )
}
