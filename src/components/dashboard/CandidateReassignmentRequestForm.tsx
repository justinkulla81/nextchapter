'use client'

import { useActionState } from 'react'
import { requestCandidateReassignment } from '@/app/dashboard/coach-dossier/actions'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

// §A5.4 "one-tap reassignment request from either side, no blame." Not a
// coach quality complaint — just a mismatch worth flagging so admin can
// find a better fit. Never reassigns on submit; it lands in an admin queue.
export function CandidateReassignmentRequestForm() {
  const [state, formAction, pending] = useActionState(requestCandidateReassignment, undefined)

  if (state?.success) {
    return (
      <p className="text-sm text-success">
        Sent to our team. Nothing changes with your coach in the meantime — we&apos;ll reach out once
        we&apos;ve found a better match.
      </p>
    )
  }

  return (
    <form action={formAction} className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <Label htmlFor="candidate-reassignment-reason" className="text-sm text-muted-foreground">
        Not clicking with your coach? You can ask us to match you with someone else — no explanation
        required.
      </Label>
      <Textarea
        id="candidate-reassignment-reason"
        name="reason"
        rows={2}
        placeholder="Optional — anything that would help us find a better match"
      />
      <SubmitButton variant="outline" size="sm" pendingLabel="Sending…">
        Request a different coach
      </SubmitButton>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
