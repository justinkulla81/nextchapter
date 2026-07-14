'use client'

import { useActionState } from 'react'
import { getReactionSummaryAction } from '@/app/dashboard/job-fit/actions'
import { Button } from '@/components/ui/button'

export function JobReactionSummary() {
  const [state, formAction, pending] = useActionState(getReactionSummaryAction, undefined)

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
