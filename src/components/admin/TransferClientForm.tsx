'use client'

import { useActionState } from 'react'
import { transferClient } from '@/app/support/admin/(portal)/coaches/[id]/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

// §A5.4 coach-departure handoff — one admin action, generates the
// §A5.1-backed handoff summary server-side (see adminTransferClient).
export function TransferClientForm({
  coachId,
  candidateId,
  otherCoaches,
}: {
  coachId: string
  candidateId: string
  otherCoaches: { id: string; fullName: string }[]
}) {
  const [state, formAction, pending] = useActionState(transferClient.bind(null, coachId, candidateId), undefined)

  if (otherCoaches.length === 0) return null

  return (
    <form
      action={formAction}
      className={cn('mt-1 flex flex-wrap items-center gap-2', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <select name="toCoachId" required className="h-8 rounded-md border border-input bg-background px-2 text-xs" defaultValue="">
        <option value="" disabled>
          Transfer to…
        </option>
        {otherCoaches.map((c) => (
          <option key={c.id} value={c.id}>
            {c.fullName}
          </option>
        ))}
      </select>
      <input type="hidden" name="reason" value="Coach departure / admin-initiated transfer" />
      <SubmitButton size="sm" variant="outline" pendingLabel="Transferring…">
        Transfer
      </SubmitButton>
      {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  )
}
