'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { acceptSeatInviteAction } from '@/app/talent/seats/accept/[token]/actions'

export function AcceptSeatButton({ seatToken }: { seatToken: string }) {
  const [state, formAction] = useActionState(acceptSeatInviteAction.bind(null, seatToken), undefined)

  return (
    <form action={formAction} className="space-y-3">
      <SubmitButton pendingLabel="Joining team…">Accept invite</SubmitButton>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
