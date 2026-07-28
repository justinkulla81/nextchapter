'use client'

import { useActionState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { sendCoachClientInvite } from '@/app/support/coach/(app)/invite-client/actions'

export function InviteClientForm() {
  const [state, formAction] = useActionState(sendCoachClientInvite, undefined)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.sent) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Their email</Label>
          <Input id="email" name="email" type="email" required placeholder="client@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Their name (optional)</Label>
          <Input id="name" name="name" placeholder="Jane Doe" />
        </div>
      </div>
      <SubmitButton pendingLabel="Sending invite…">Send invite</SubmitButton>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.sent && <p className="text-sm text-brand">Invite sent.</p>}
    </form>
  )
}
