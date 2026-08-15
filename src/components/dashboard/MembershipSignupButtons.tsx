'use client'

import { useActionState } from 'react'
import { subscribeToMembership, type FormState } from '@/app/dashboard/membership/actions'
import { SubmitButton } from '@/components/ui/submit-button'

export function MembershipSignupButtons({ monthlyLabel, annualLabel }: { monthlyLabel: string; annualLabel: string }) {
  const [monthlyState, monthlyAction] = useActionState<FormState, FormData>(
    (_prevState, _formData) => subscribeToMembership('MONTHLY'),
    undefined
  )
  const [annualState, annualAction] = useActionState<FormState, FormData>(
    (_prevState, _formData) => subscribeToMembership('ANNUAL'),
    undefined
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        <form action={monthlyAction}>
          <SubmitButton pendingLabel="Joining…">{monthlyLabel}</SubmitButton>
        </form>
        <form action={annualAction}>
          <SubmitButton variant="outline" pendingLabel="Joining…">
            {annualLabel}
          </SubmitButton>
        </form>
      </div>
      {(monthlyState?.error || annualState?.error) && (
        <p className="text-sm text-destructive">{monthlyState?.error || annualState?.error}</p>
      )}
      {(monthlyState?.success || annualState?.success) && (
        <p className="text-sm text-success">{monthlyState?.success || annualState?.success}</p>
      )}
    </div>
  )
}
