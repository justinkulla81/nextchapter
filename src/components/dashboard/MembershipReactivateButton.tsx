'use client'

import { useActionState } from 'react'
import { reactivateMembership, type FormState } from '@/app/dashboard/membership/actions'
import { SubmitButton } from '@/components/ui/submit-button'

// §A2.4 "break-glass reactivation" -- the real, one-click flow, not a copy
// promise.
export function MembershipReactivateButton() {
  const [state, formAction] = useActionState<FormState, FormData>((_prevState, _formData) => reactivateMembership(), undefined)

  return (
    <div className="space-y-1">
      <form action={formAction}>
        <SubmitButton pendingLabel="Reactivating…">Reactivate my Membership</SubmitButton>
      </form>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">{state.success}</p>}
    </div>
  )
}
