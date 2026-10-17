'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { cancelMySession } from '@/app/dashboard/book-session/actions'

// Cancelling frees the time for someone else and tells your coach, so it asks first and the safe
// choice (keep the session) has the focus.
export function CancelSessionForm({ bookingId }: { bookingId: string }) {
  const [state, action] = useActionState(cancelMySession, undefined)
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(true)}>
        Cancel session
      </Button>
    )
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label="Confirm cancelling this session">
      <input type="hidden" name="bookingId" value={bookingId} />
      <span className="text-xs text-foreground">Cancel this session?</span>
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
