'use client'

import { useActionState, useState } from 'react'
import { disputeReference, type FormState } from '@/app/dashboard/references/actions'
import { SubmitButton } from '@/components/ui/submit-button'

interface ReferenceDisputeControlProps {
  referenceId: string
  disputeNote: string | null
  disputedAt: Date | null
  resolvedAt: Date | null
}

export function ReferenceDisputeControl({
  referenceId,
  disputeNote,
  disputedAt,
  resolvedAt,
}: ReferenceDisputeControlProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState<FormState, FormData>(disputeReference, undefined)

  const isUnderReview = disputedAt && !resolvedAt

  if (isUnderReview) {
    return (
      <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <span className="font-medium">Under review</span> — this reference won&apos;t appear in
        your Recruiter Report until it&apos;s resolved.
        {disputeNote && <p className="mt-1 text-amber-700">Your note: &quot;{disputeNote}&quot;</p>}
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Something not right? Flag this reference
      </button>
    )
  }

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="referenceId" value={referenceId} />
      <textarea
        name="note"
        required
        rows={3}
        placeholder="What seems off about this reference? We'll hold it out of your Recruiter Report while we look into it."
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <SubmitButton
          variant="outline"
          size="sm"
          pendingLabel="Submitting…"
        >
          Submit
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
