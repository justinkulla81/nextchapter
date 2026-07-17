'use client'

import { useActionState } from 'react'
import { Lock } from 'lucide-react'
import { getReactionSummaryAction } from '@/app/dashboard/find-my-job/actions'
import { Button } from '@/components/ui/button'

const MIN_RATINGS_FOR_PATTERN = 5

export function JobReactionSummary({ ratedCount }: { ratedCount: number }) {
  const [state, formAction, pending] = useActionState(getReactionSummaryAction, undefined)

  if (ratedCount < MIN_RATINGS_FOR_PATTERN) {
    return (
      <div className="rounded-lg border border-dashed border-light-gray bg-off-white p-4">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">What&apos;s my pattern? — locked</p>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          You need {MIN_RATINGS_FOR_PATTERN} interested jobs to train our AI on your pattern —
          rate {MIN_RATINGS_FOR_PATTERN - ratedCount} more job
          {MIN_RATINGS_FOR_PATTERN - ratedCount === 1 ? '' : 's'} to unlock this.
        </p>
      </div>
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
