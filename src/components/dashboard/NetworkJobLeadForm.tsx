'use client'

import { useActionState } from 'react'
import { submitNetworkJobLead } from '@/app/dashboard/network/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

// A contact tells you about an opening — this gets it in front of an admin
// for the shared Job Board, unlike the private "See how you fit a job"
// check on Find My Job (which never leaves your own view). Kept deliberately
// light — just the URL is required — since demanding a full contact/salary
// form here would be too much friction for quickly logging a tip.
export function NetworkJobLeadForm() {
  const [state, formAction, pending] = useActionState(submitNetworkJobLead, undefined)

  return (
    <form
      action={formAction}
      className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="jobLeadUrl">Posting URL</Label>
        <Input id="jobLeadUrl" name="url" type="url" required placeholder="https://" disabled={pending} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="jobLeadCompany">Company (if you know it)</Label>
          <Input id="jobLeadCompany" name="companyName" disabled={pending} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jobLeadTitle">Role (if you know it)</Label>
          <Input id="jobLeadTitle" name="title" disabled={pending} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="jobLeadNote">How you heard about it (optional)</Label>
        <Input id="jobLeadNote" name="note" placeholder="e.g. a former colleague mentioned it" disabled={pending} />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-success">
          Sent for review — it&apos;ll show up on the shared Job Board once an admin confirms it.
        </p>
      )}
      <SubmitButton size="sm" pendingLabel="Submitting…">
        Submit for review
      </SubmitButton>
    </form>
  )
}
