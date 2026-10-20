'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { redeemCode } from '@/app/dashboard/my-coaching/actions'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'

export function RedeemCoachCodeForm({ redesign = false }: { redesign?: boolean } = {}) {
  const [state, action] = useActionState(redeemCode, undefined)
  // The redesign: body-size label and input, and a quiet button (the page's orange action is elsewhere).
  if (redesign) {
    return (
      <form action={action} className="space-y-2">
        <Label htmlFor="code" className="text-base font-semibold text-ink">Code from your coach</Label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input id="code" name="code" defaultValue={state?.code ?? ''} placeholder="NC-XXXX-XXXX" autoComplete="off" className="h-11 text-base uppercase sm:w-64" />
          <ActionSubmit variant="secondary" pendingLabel="Checking…" event="coach_code_submitted" props={{ source: 'my_coaching' }}>Use code</ActionSubmit>
        </div>
        {state?.error && <p role="alert" className="text-base text-destructive">{state.error}</p>}
        {state?.ok && <p role="status" className="text-base text-ink">{state.ok}</p>}
      </form>
    )
  }
  return (
    <form action={action} className="space-y-2">
      <Label htmlFor="code">Have a code from a coach?</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id="code" name="code" defaultValue={state?.code ?? ''} placeholder="NC-XXXX-XXXX" autoComplete="off" className="uppercase sm:w-56" />
        <SubmitButton pendingLabel="Checking…">Use code</SubmitButton>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.ok && <p className="text-sm text-brand">{state.ok}</p>}
    </form>
  )
}
