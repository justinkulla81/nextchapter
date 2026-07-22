'use client'

import { useActionState, useState } from 'react'
import type { FormState } from '@/app/support/admin/exclusive-jobs/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { cn } from '@/lib/utils'

const POSTING_TYPE_OPTIONS = [
  { value: 'direct' as const, label: 'Direct employer posting' },
  { value: 'recruiter_search' as const, label: 'Recruiter-led search' },
]

export function ExclusiveJobPostingForm({
  action,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [postingType, setPostingType] = useState<'direct' | 'recruiter_search' | null>(null)

  return (
    <form
      action={formAction}
      className={cn(
        'space-y-4 rounded-lg border border-border p-4',
        pending && 'cursor-progress [&_*]:cursor-progress'
      )}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Job title</Label>
          <Input id="title" name="title" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyName">Company</Label>
          <Input id="companyName" name="companyName" required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location">Location (optional)</Label>
          <Input id="location" name="location" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="url">Real posting URL</Label>
          <Input id="url" name="url" type="url" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Direct or recruiter-led?</Label>
        <ChoiceButtons name="postingType" options={POSTING_TYPE_OPTIONS} value={postingType} onChange={setPostingType} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contactName">Named contact</Label>
          <Input id="contactName" name="contactName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Contact email</Label>
          <Input id="contactEmail" name="contactEmail" type="email" required />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="salaryMin">Salary minimum</Label>
          <Input id="salaryMin" name="salaryMin" type="number" required min={0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salaryMax">Salary maximum</Label>
          <Input id="salaryMax" name="salaryMax" type="number" required min={0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salaryCurrency">Currency</Label>
          <Input id="salaryCurrency" name="salaryCurrency" defaultValue="USD" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Note for candidates (optional)</Label>
        <Input id="description" name="description" placeholder="Why this one's worth a look" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Adding…">Add exclusive posting</SubmitButton>
    </form>
  )
}
