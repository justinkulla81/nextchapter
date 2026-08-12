'use client'

import { useActionState, useState } from 'react'
import { declineReference, type FormState } from '@/app/ref/[token]/actions'
import { SubmitButton } from '@/components/ui/submit-button'

// Low-emphasis escape hatch for a referee who isn't going to finish this —
// gives the candidate a real, immediate signal (see declineReference)
// instead of the request just going silent forever.
export function DeclineReferenceControl({ token }: { token: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState<FormState, FormData>(declineReference, undefined)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Can&apos;t do this right now?
      </button>
    )
  }

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-border p-3">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-foreground">
        No problem — we&apos;ll let them know you&apos;re not able to, and they won&apos;t be
        notified again about this.
      </p>
      <textarea
        name="reason"
        rows={2}
        placeholder="Reason (optional) — shared with the candidate"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <SubmitButton variant="outline" size="sm" pendingLabel="Declining…">
          Decline this reference
        </SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground underline underline-offset-4"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
