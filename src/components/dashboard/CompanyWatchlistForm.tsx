'use client'

import { useActionState, useRef, useEffect } from 'react'
import { addWatchlistCompany } from '@/app/dashboard/company-tracker/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'

export function CompanyWatchlistForm() {
  const [state, formAction, pending] = useActionState(addWatchlistCompany, undefined)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!pending && !state?.error) formRef.current?.reset()
  }, [pending, state])

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-start gap-2">
      <Input
        name="companyName"
        placeholder="e.g. Salesforce"
        aria-label="Company name"
        className="max-w-xs"
        required
      />
      <SubmitButton pendingLabel="Adding…" className={pending ? 'cursor-progress' : ''}>
        Add to watchlist
      </SubmitButton>
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
