'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { redeemCode } from '@/app/dashboard/my-coaching/actions'

export function RedeemCoachCodeForm() {
  const [state, action] = useActionState(redeemCode, undefined)
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
