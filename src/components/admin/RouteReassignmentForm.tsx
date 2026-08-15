'use client'

import { useActionState } from 'react'
import { routeReassignmentRequest, declineReassignmentRequest } from '@/app/support/admin/(portal)/coaching-reassignments/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

export function RouteReassignmentForm({
  requestId,
  eligibleCoaches,
}: {
  requestId: string
  eligibleCoaches: { id: string; fullName: string }[]
}) {
  const [state, formAction, pending] = useActionState(routeReassignmentRequest.bind(null, requestId), undefined)

  return (
    <div className={cn('flex flex-wrap items-center gap-2', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <select name="toCoachId" required className="h-8 rounded-md border border-input bg-background px-2 text-xs" defaultValue="">
          <option value="" disabled>
            Route to…
          </option>
          {eligibleCoaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </select>
        <SubmitButton size="sm" pendingLabel="Routing…">
          Approve &amp; transfer
        </SubmitButton>
      </form>
      <form action={declineReassignmentRequest.bind(null, requestId)}>
        <SubmitButton size="sm" variant="outline">
          Decline
        </SubmitButton>
      </form>
      {state?.error && <span className="w-full text-xs text-destructive">{state.error}</span>}
    </div>
  )
}
