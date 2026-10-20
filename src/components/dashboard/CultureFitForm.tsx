'use client'

import { useActionState } from 'react'
import { saveCultureFit } from '@/app/dashboard/search-strategy/actions'
import { CultureFitFields } from '@/components/onboarding/CultureFitFields'
import { SubmitButton } from '@/components/ui/submit-button'
import type { CultureFit } from '@/lib/culture/culture-fit'

// Search Strategy > Culture and working environment. Saves on its own so it is
// quick to change when what matters changes.
export function CultureFitForm({ fit }: { fit: CultureFit | null }) {
  const [state, action] = useActionState(saveCultureFit, undefined)
  return (
    <form action={action} className="space-y-4">
      <CultureFitFields defaults={fit} />
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <SubmitButton>Save culture preferences</SubmitButton>
    </form>
  )
}
