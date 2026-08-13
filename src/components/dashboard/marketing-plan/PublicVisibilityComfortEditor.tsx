'use client'

import type { PublicDisclosureComfort } from '@prisma/client'
import { SubmitButton } from '@/components/ui/submit-button'
import { PUBLIC_DISCLOSURE_COMFORT_OPTIONS } from '@/lib/constants/onboarding'
import { updatePublicDisclosureComfort } from '@/app/dashboard/marketing-plan/actions'

// Same always-editable pattern as NetworkComfortCheck.tsx — this used to be
// onboarding-only (GoalsForm.tsx), with nowhere to update it afterward, even
// though it now drives real branching on this page. Re-answering is safe any
// time; it never re-awards or claws back the one-time confirm bonus above.
export function PublicVisibilityComfortEditor({ current }: { current: PublicDisclosureComfort | null }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {PUBLIC_DISCLOSURE_COMFORT_OPTIONS.map((opt) => (
        <form key={opt.value} action={updatePublicDisclosureComfort.bind(null, opt.value)}>
          <SubmitButton
            variant={opt.value === current ? 'default' : 'outline'}
            size="sm"
            className="w-full justify-start text-left whitespace-normal"
          >
            {opt.label}
          </SubmitButton>
        </form>
      ))}
    </div>
  )
}
