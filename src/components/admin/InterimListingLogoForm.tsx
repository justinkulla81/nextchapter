'use client'

import { useActionState } from 'react'
import { updateInterimListingLogo } from '@/app/support/admin/(portal)/interim-listings/actions'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'

export function InterimListingLogoForm({ listingId, logoUrl }: { listingId: string; logoUrl: string | null }) {
  const [state, formAction, pending] = useActionState(updateInterimListingLogo, undefined)

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="listingId" value={listingId} />
      <Input
        name="logoUrl"
        type="url"
        defaultValue={logoUrl ?? ''}
        placeholder="Logo URL"
        className="h-8 w-[180px] text-xs"
      />
      <SubmitButton variant="ghost" size="sm" pendingLabel="Saving…" className={pending ? 'cursor-progress' : ''}>
        Save
      </SubmitButton>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  )
}
