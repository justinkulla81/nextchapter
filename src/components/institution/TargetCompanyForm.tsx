'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { addTargetCompany } from '@/app/institution/(app)/companies/actions'

export function TargetCompanyForm() {
  const [state, action] = useActionState(addTargetCompany, undefined)
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
      <div className="min-w-48 flex-1 space-y-1">
        <label htmlFor="companyName" className="text-sm font-medium">Company</label>
        <Input id="companyName" name="companyName" required />
      </div>
      <div className="min-w-48 flex-1 space-y-1">
        <label htmlFor="note" className="text-sm font-medium">Note (private to your team)</label>
        <Input id="note" name="note" />
      </div>
      <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
