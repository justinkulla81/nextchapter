'use client'

import { useActionState } from 'react'
import { confirmProfile } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function ProfileConfirmForm({
  firstName,
  lastName,
  phone,
  streetAddress,
  currentCity,
  currentState,
}: {
  firstName: string | null
  lastName: string | null
  phone: string | null
  streetAddress: string | null
  currentCity: string | null
  currentState: string | null
}) {
  const [state, formAction, pending] = useActionState(confirmProfile, undefined)

  return (
    <form
      action={formAction}
      className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="grid grid-cols-2 gap-2">
        <Input name="firstName" placeholder="First name" defaultValue={firstName ?? ''} />
        <Input name="lastName" placeholder="Last name" defaultValue={lastName ?? ''} />
      </div>
      <Input name="phone" placeholder="Phone" defaultValue={phone ?? ''} />
      <Input name="streetAddress" placeholder="Street address" defaultValue={streetAddress ?? ''} />
      <div className="grid grid-cols-2 gap-2">
        <Input name="currentCity" placeholder="City" defaultValue={currentCity ?? ''} />
        <Input name="currentState" placeholder="State" defaultValue={currentState ?? ''} />
      </div>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? 'Saving…' : 'Confirm'}
      </Button>
      <Label className="block text-xs font-normal text-muted-foreground">
        Pre-filled from your resume — correct anything that&apos;s off.
      </Label>
    </form>
  )
}
