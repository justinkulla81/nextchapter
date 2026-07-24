'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { inviteSeat } from '@/app/talent/(app)/team/actions'

export function InviteSeatForm() {
  const [state, formAction] = useActionState(inviteSeat, undefined)

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-2">
        <Label htmlFor="email">Invite a teammate</Label>
        <Input id="email" name="email" type="email" placeholder="teammate@company.com" required />
      </div>
      <SubmitButton pendingLabel="Sending invite…">Send invite</SubmitButton>
      {state?.error && <p className="text-sm text-destructive sm:basis-full">{state.error}</p>}
    </form>
  )
}
