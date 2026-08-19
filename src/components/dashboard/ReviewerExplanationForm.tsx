'use client'

import { useActionState } from 'react'
import { submitReviewerExplanation } from '@/app/dashboard/market-reality/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ReviewerDetectionType } from '@/lib/scoring/resume-analysis/types'

// Report Structure Spec §3.4 — the Search Action Task attached to each
// reviewer-read item: recording a one-line answer removes the item from
// this list (see getRecruiterReadItems, which only ever reads unresolved
// rows). No "flaw" language anywhere here on purpose — this is framed as
// interview prep, matching the copy above it.
export function ReviewerExplanationForm({
  id,
  placeholder,
  detectionType,
  detectedContext,
}: {
  id: string
  placeholder: string
  detectionType: ReviewerDetectionType
  detectedContext: Record<string, unknown>
}) {
  const [state, formAction, pending] = useActionState(submitReviewerExplanation, undefined)

  // OVERLAPPING_ROLES' real answer is always "which of these two roles was
  // the full-time one" — a genuine 2-option choice, not open-ended text.
  // Design principle: 2-4 discrete options render as adjacent buttons, not
  // a free-text box asking the candidate to type back one of two names we
  // already know.
  if (detectionType === 'OVERLAPPING_ROLES') {
    const a = typeof detectedContext.a === 'string' ? detectedContext.a : null
    const b = typeof detectedContext.b === 'string' ? detectedContext.b : null
    if (a && b) {
      return (
        <div className={cn('mt-2 flex flex-wrap gap-2', pending && 'cursor-progress [&_*]:cursor-progress')}>
          {[a, b].map((roleName) => (
            <form key={roleName} action={formAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="explanation" value={`${roleName} was the full-time role.`} />
              <Button type="submit" variant="outline" size="sm" disabled={pending}>
                {roleName} was full-time
              </Button>
            </form>
          ))}
          {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
        </div>
      )
    }
  }

  return (
    <form
      action={formAction}
      className={cn('mt-2 flex flex-col gap-2 sm:flex-row sm:items-start', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <input type="hidden" name="id" value={id} />
      <Textarea
        name="explanation"
        placeholder={placeholder}
        rows={1}
        className="min-h-9 flex-1 text-sm"
        required
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending} className="shrink-0">
        {pending ? 'Saving…' : 'Save answer'}
      </Button>
      {state?.error && <p className="text-sm text-destructive sm:basis-full">{state.error}</p>}
    </form>
  )
}
