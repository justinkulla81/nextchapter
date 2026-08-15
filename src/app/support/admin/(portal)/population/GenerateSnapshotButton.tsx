'use client'

import { useActionState } from 'react'
import { generateThisWeekSnapshotAction } from './actions'
import { SubmitButton } from '@/components/ui/submit-button'

// Manual "generate this week's snapshot now" trigger (see actions.ts for
// why this exists alongside the Monday 00:15 UTC cron). Uses the shared
// SubmitButton for the busy-cursor state and success flash per
// design-principles.md's "every action that changes data or state must
// give immediate visible feedback" rule, instead of a bespoke button.
export function GenerateSnapshotButton() {
  const [state, formAction] = useActionState(generateThisWeekSnapshotAction, undefined)

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <SubmitButton pendingLabel="Generating…">Generate this week&apos;s snapshot now</SubmitButton>
      {state?.success && <p className="text-sm text-green-700">{state.success}</p>}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  )
}
