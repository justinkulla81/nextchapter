'use client'

import { useActionState } from 'react'
import { getReactionSummaryAction } from '@/app/dashboard/job-fit/actions'
import { Button } from '@/components/ui/button'

const MIN_RATINGS_FOR_PATTERN = 5

export function JobReactionSummary({ ratedCount }: { ratedCount: number }) {
  const [state, formAction, pending] = useActionState(getReactionSummaryAction, undefined)

  if (ratedCount < MIN_RATINGS_FOR_PATTERN) {
    return (
      <p className="text-sm text-muted-foreground">
        Rate {MIN_RATINGS_FOR_PATTERN - ratedCount} more job
        {MIN_RATINGS_FOR_PATTERN - ratedCount === 1 ? '' : 's'} to unlock &ldquo;What&apos;s my
        pattern?&rdquo;
      </p>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <form action={formAction}>
        <Button type="submit" variant="outline" size="sm" disabled={pending} className={pending ? 'cursor-progress' : ''}>
          {pending ? 'Reading your pattern…' : "What's my pattern?"}
        </Button>
      </form>
      {state?.error && <p className="text-sm text-muted-foreground">{state.error}</p>}
      {state?.summary && <p className="text-sm text-foreground">{state.summary}</p>}
    </div>
  )
}
