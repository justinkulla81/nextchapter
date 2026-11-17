'use client'

import { useActionState } from 'react'
import { approveClaimAction, declineClaimAction, type ClaimDecisionState } from '@/app/support/admin/(portal)/organizations/claims/actions'

// Approve (the primary action) and Decline (asks first) for one claim, with the result shown in place.
export function ClaimDecisionButtons({ claimId, orgName, claimant }: { claimId: string; orgName: string; claimant: string }) {
  const [approved, approve, approving] = useActionState<ClaimDecisionState, FormData>(approveClaimAction.bind(null, claimId), undefined)
  const [declined, decline, declining] = useActionState<ClaimDecisionState, FormData>(declineClaimAction.bind(null, claimId), undefined)
  const busy = approving || declining
  const result = approved ?? declined
  if (result?.ok) return <p role="status" className="text-sm text-success">{result.message}</p>
  return (
    <div className={busy ? 'cursor-wait space-y-2' : 'space-y-2'}>
      <div className="flex flex-wrap gap-2">
        <form action={approve}>
          <button type="submit" disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-wait disabled:opacity-70">
            {approving ? 'Opening the workspace…' : 'Approve and open the workspace'}
          </button>
        </form>
        <form
          action={decline}
          onSubmit={(e) => {
            if (!window.confirm(`Decline ${claimant}'s claim to ${orgName}? Nothing will be created.`)) e.preventDefault()
          }}
        >
          <button type="submit" disabled={busy} className="rounded-full border border-border px-4 py-2 text-sm font-medium disabled:cursor-wait disabled:opacity-70">
            Decline
          </button>
        </form>
      </div>
      {result && !result.ok && <p role="alert" className="text-sm text-destructive">{result.message}</p>}
    </div>
  )
}
