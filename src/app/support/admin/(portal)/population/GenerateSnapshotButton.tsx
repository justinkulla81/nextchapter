'use client'

import { useActionState } from 'react'
import { generateThisWeekSnapshotAction } from './actions'
import { cn } from '@/lib/utils'

// Manual "generate this week's snapshot now" trigger (see actions.ts for
// why this exists alongside the Monday 00:15 UTC cron). Cursor-wait state
// while pending and an explicit success/error message per
// design-principles.md's "every action that changes data or state must
// give immediate visible feedback" rule.
export function GenerateSnapshotButton() {
  const [state, formAction, pending] = useActionState(generateThisWeekSnapshotAction, undefined)

  return (
    <form action={formAction} className={cn('flex flex-col items-start gap-2', pending && 'cursor-progress')}>
      <button
        type="submit"
        disabled={pending}
        className={cn(
          'rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-60',
          pending && 'cursor-progress'
        )}
      >
        {pending ? 'Generating…' : "Generate this week's snapshot now"}
      </button>
      {state?.success && <p className="text-sm text-green-700">{state.success}</p>}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  )
}
