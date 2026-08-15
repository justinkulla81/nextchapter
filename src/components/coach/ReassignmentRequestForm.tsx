'use client'

import { useActionState } from 'react'
import { requestClientReassignment } from '@/app/support/coach/(app)/clients/[token]/[clientId]/actions'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

// §A5.4 "one-tap reassignment request from either side, no blame, admin
// routes." A coach flags a mismatch here — the reason is optional and
// nothing about this form implies fault; admin reviews the queue and
// decides where the candidate goes next, this never reassigns on its own.
export function ReassignmentRequestForm({ token, clientId }: { token: string; clientId: string }) {
  const [state, formAction, pending] = useActionState(requestClientReassignment.bind(null, token, clientId), undefined)

  if (state?.success) {
    return (
      <p className="text-sm text-success">
        Request sent to admin. This doesn&apos;t change anything about this client&apos;s access in the meantime.
      </p>
    )
  }

  return (
    <form action={formAction} className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <Label htmlFor="reassignment-reason" className="text-sm text-muted-foreground">
        Not the right fit? Ask admin to reassign this client — no blame, just a mismatch worth fixing.
      </Label>
      <Textarea
        id="reassignment-reason"
        name="reason"
        rows={2}
        placeholder="Optional — what would help admin find a better match"
      />
      <SubmitButton variant="outline" size="sm" pendingLabel="Sending…">
        Request reassignment
      </SubmitButton>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
