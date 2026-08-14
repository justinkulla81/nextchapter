'use client'

import { useActionState } from 'react'
import { submitReviewerExplanation } from '@/app/dashboard/market-reality/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

// Report Structure Spec §3.4 — the Search Action Task attached to each
// reviewer-read item: recording a one-line answer removes the item from
// this list (see getRecruiterReadItems, which only ever reads unresolved
// rows). No "flaw" language anywhere here on purpose — this is framed as
// interview prep, matching the copy above it.
export function ReviewerExplanationForm({ id, placeholder }: { id: string; placeholder: string }) {
  const [state, formAction, pending] = useActionState(submitReviewerExplanation, undefined)

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
