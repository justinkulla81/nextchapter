'use client'

import { useActionState, useState } from 'react'
import { confirmProfile } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { ConfirmHint } from '@/components/dashboard/ConfirmHint'
import { cn } from '@/lib/utils'

const POINTS = estimateActionEffort({ actionType: 'PROFILE_CONFIRM' }).points

export function ProfileConfirmForm({
  firstName,
  lastName,
  phone,
  streetAddress,
  currentCity,
  currentState,
  confirmedAt,
}: {
  firstName: string | null
  lastName: string | null
  phone: string | null
  streetAddress: string | null
  currentCity: string | null
  currentState: string | null
  confirmedAt: Date | null
}) {
  const [state, formAction, pending] = useActionState(confirmProfile, undefined)

  // Controlled inputs so "has anything changed since the last confirm" can
  // be compared directly against the server-confirmed values passed in as
  // props — those props always reflect exactly what's in the database, so
  // there's no separate "snapshot" to maintain.
  const [values, setValues] = useState({
    firstName: firstName ?? '',
    lastName: lastName ?? '',
    phone: phone ?? '',
    streetAddress: streetAddress ?? '',
    currentCity: currentCity ?? '',
    currentState: currentState ?? '',
  })

  const isConfirmed = !!confirmedAt
  const isDirty =
    values.firstName !== (firstName ?? '') ||
    values.lastName !== (lastName ?? '') ||
    values.phone !== (phone ?? '') ||
    values.streetAddress !== (streetAddress ?? '') ||
    values.currentCity !== (currentCity ?? '') ||
    values.currentState !== (currentState ?? '')
  const canConfirm = !isConfirmed || isDirty

  return (
    <form
      action={formAction}
      className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <ConfirmHint show={!isConfirmed} />
      <div className="grid grid-cols-2 gap-2">
        <Input
          name="firstName"
          placeholder="First name"
          value={values.firstName}
          onChange={(e) => setValues((v) => ({ ...v, firstName: e.target.value }))}
        />
        <Input
          name="lastName"
          placeholder="Last name"
          value={values.lastName}
          onChange={(e) => setValues((v) => ({ ...v, lastName: e.target.value }))}
        />
      </div>
      <Input
        name="phone"
        placeholder="Phone"
        value={values.phone}
        onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
      />
      <Input
        name="streetAddress"
        placeholder="Street address"
        value={values.streetAddress}
        onChange={(e) => setValues((v) => ({ ...v, streetAddress: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          name="currentCity"
          placeholder="City"
          value={values.currentCity}
          onChange={(e) => setValues((v) => ({ ...v, currentCity: e.target.value }))}
        />
        <Input
          name="currentState"
          placeholder="State"
          value={values.currentState}
          onChange={(e) => setValues((v) => ({ ...v, currentState: e.target.value }))}
        />
      </div>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant={canConfirm ? 'outline' : 'ghost'} disabled={pending || !canConfirm}>
          {pending ? 'Saving…' : isConfirmed ? (isDirty ? 'Reconfirm' : 'Confirmed') : 'Confirm'}
        </Button>
        {!isConfirmed && <span className="text-xs font-medium text-muted-foreground tabular-nums">+{POINTS} pts</span>}
      </div>
      <Label className="block text-xs font-normal text-muted-foreground">
        Pre-filled from your resume — correct anything that&apos;s off.
      </Label>
    </form>
  )
}
