'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { cancelCoachSession } from '@/app/support/coach/(app)/booking/actions'

export function CancelCoachSessionForm({ bookingId, clientName }: { bookingId: string; clientName: string }) {
  const [state, action] = useActionState(cancelCoachSession, undefined)
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(true)} aria-label={`Cancel the session with ${clientName}`}>
        Cancel session
      </Button>
    )
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label={`Confirm cancelling the session with ${clientName}`}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <span className="text-xs text-foreground">Cancel and tell {clientName}?</span>
      <Button type="button" size="sm" autoFocus onClick={() => setConfirming(false)}>
        Keep session
      </Button>
      <SubmitButton size="sm" variant="destructive" pendingLabel="Cancelling…" savedLabel="Cancel session">
        Cancel session
      </SubmitButton>
      {state?.error && (
        <span role="alert" className="text-xs text-destructive">
          {state.error}
        </span>
      )}
    </form>
  )
}
