import { TrackedLink } from '@/components/marketing/TrackedLink'
import { buttonVariants } from '@/components/ui/button'
import { PERSONALIZE_HREF } from '@/components/home/PersonalizePanel'
import { cn } from '@/lib/utils'

// The fit offer on a public job page: one promise, one button, visible without scrolling.
// It replaced a 6-point list and a 3-step explainer at the bottom of a long sidebar; in the
// 14 days to 2026-10-27, 484 visitors viewed job pages, 85 clicked Apply and 2 clicked the old button.
// `placement` separates the two copies (under Apply on every screen size's flow, and a sticky side card on desktop).
export function JobFitCard({ jobId, placement, className }: { jobId: string; placement: 'inline' | 'side'; className?: string }) {
  return (
    <aside className={cn('rounded-2xl border border-border bg-white p-4 sm:p-5', className)} aria-label="Check your fit for this job">
      <div className="flex items-center gap-4">
        <FitRing />
        <div className="min-w-0">
          <p className="font-display text-lg leading-snug font-semibold">Would you get an interview?</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Upload your résumé and see your match to this job. Free, about a minute.</p>
        </div>
      </div>
      <TrackedLink
        href={`${PERSONALIZE_HREF}&job=${encodeURIComponent(jobId)}`}
        event="jobs_page_personalize_clicked"
        properties={{ placement: placement === 'inline' ? 'job_page_inline' : 'job_page_side', jobId }}
        className={cn(buttonVariants({ size: 'lg' }), 'mt-4 h-12 w-full rounded-full bg-action text-action-foreground hover:brightness-95')}
      >
        Check my fit
      </TrackedLink>
    </aside>
  )
}

// An empty gauge with a question mark: the score is what the visitor is about to get.
function FitRing() {
  return (
    <svg viewBox="0 0 56 56" className="size-14 shrink-0" aria-hidden>
      <circle cx="28" cy="28" r="23" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="6" />
      <circle cx="28" cy="28" r="23" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray="36 145" transform="rotate(-90 28 28)" className="text-ink" />
      <text x="28" y="34" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">?</text>
    </svg>
  )
}
