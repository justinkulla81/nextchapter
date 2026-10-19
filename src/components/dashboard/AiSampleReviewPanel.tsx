'use client'

import { useActionState } from 'react'
import { Check, Minus } from 'lucide-react'
import { SubmitButton } from '@/components/ui/submit-button'
import { requestAiSampleReview, type ReviewFormState } from '@/app/dashboard/work-samples/review-actions'
import { AI_SAMPLE_SPECS, type AiSampleType } from '@/lib/evidence/ai-work-samples'
import { VERDICT_LABEL, type ReviewCheck, type ReviewVerdict } from '@/lib/evidence/ai-sample-review'

export type PanelReview = { verdict: ReviewVerdict; checks: ReviewCheck[]; summary: string; suggestions: string[]; createdAt: string }

// The AI review of one work sample, for the member only. States the limits plainly: it reads what they
// wrote, it cannot verify claims, and nobody else sees it.
export function AiSampleReviewPanel({ sampleId, sampleType, review, remaining, nextAvailable }: { sampleId: string; sampleType: AiSampleType; review: PanelReview | null; remaining: number; nextAvailable: string | null }) {
  const [state, action] = useActionState(requestAiSampleReview.bind(null, sampleId), undefined as ReviewFormState)
  const labels = Object.fromEntries(AI_SAMPLE_SPECS[sampleType].checks.map((c) => [c.key, c.label]))
  const when = review ? new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null

  return (
    <div className="space-y-3 border-t border-border pt-4">
      {review && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            AI review: <span className="text-primary">{VERDICT_LABEL[review.verdict]}</span>
          </p>
          <p className="text-sm text-foreground">{review.summary}</p>
          <ul className="space-y-1">
            {review.checks.map((c) => (
              <li key={c.key} className="flex items-start gap-2 text-sm">
                {c.met ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Met" /> : <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Not yet" />}
                <span>
                  <span className="font-medium">{labels[c.key] ?? c.key}.</span> <span className="text-muted-foreground">{c.reason}</span>
                </span>
              </li>
            ))}
          </ul>
          {review.suggestions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">To make it stronger</p>
              <ul className="list-disc pl-5 text-sm">
                {review.suggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            A model’s reading of what you wrote on {when}. It can’t verify your claims. Only you can see it; recruiters and employers never do, and it doesn’t change your evidence score.
          </p>
        </div>
      )}

      {remaining > 0 ? (
        <form action={action} className="space-y-2">
          <SubmitButton variant="outline" size="sm" pendingLabel="Reviewing…">
            {review ? 'Review again' : 'Get an AI review'}
          </SubmitButton>
          <p className="text-xs text-muted-foreground">
            {remaining} of 3 reviews left for this sample this week.{!review && ' It reads what you wrote against the checks above and tells you what to add.'}
          </p>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">You have used 3 reviews of this sample this week. Edit it and review again{nextAvailable ? ` on ${new Date(nextAvailable).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ' next week'}.</p>
      )}
      {state?.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
    </div>
  )
}
