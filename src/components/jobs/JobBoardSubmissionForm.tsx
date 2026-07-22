'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { cn } from '@/lib/utils'

export interface JobBoardSubmittedValues {
  title?: string
  companyName?: string
  location?: string
  url?: string
  postingType?: string
  contactName?: string
  contactEmail?: string
  salaryMin?: string
  salaryMax?: string
  salaryCurrency?: string
  description?: string
}

export type JobBoardSubmitState =
  | { error?: string; success?: boolean; values?: JobBoardSubmittedValues }
  | undefined

const POSTING_TYPE_OPTIONS = [
  { value: 'direct' as const, label: 'Direct employer posting' },
  { value: 'recruiter_search' as const, label: 'Recruiter-led search' },
]

export function JobBoardSubmissionForm({
  action,
}: {
  action: (prevState: JobBoardSubmitState, formData: FormData) => Promise<JobBoardSubmitState>
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [postingType, setPostingType] = useState<'direct' | 'recruiter_search' | null>(
    (state?.values?.postingType as 'direct' | 'recruiter_search' | undefined) ?? null
  )
  const values = state?.values

  if (state?.success) {
    return (
      <div className="rounded-lg border border-brand/30 bg-brand/5 p-4 text-sm text-foreground">
        Submitted for review — you&apos;ll hear back once it&apos;s approved. Every listing on NC
        Job Board is reviewed by a person before it goes live.
      </div>
    )
  }

  return (
    <form
      action={formAction}
      className={cn(
        'space-y-5 rounded-lg border border-border p-5',
        pending && 'cursor-progress [&_*]:cursor-progress'
      )}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Job title</Label>
          <Input id="title" name="title" required defaultValue={values?.title ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyName">Company</Label>
          <Input id="companyName" name="companyName" required defaultValue={values?.companyName ?? ''} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location">Location (optional)</Label>
          <Input id="location" name="location" defaultValue={values?.location ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="url">Posting URL</Label>
          <Input
            id="url"
            name="url"
            type="url"
            required
            placeholder="https://"
            defaultValue={values?.url ?? ''}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Is this a direct employer posting or a recruiter-led search?</Label>
        <ChoiceButtons
          name="postingType"
          options={POSTING_TYPE_OPTIONS}
          value={postingType}
          onChange={setPostingType}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contactName">Named contact (recruiter or hiring manager)</Label>
          <Input
            id="contactName"
            name="contactName"
            required
            placeholder="Not a team name or generic inbox"
            defaultValue={values?.contactName ?? ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Contact email</Label>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            required
            defaultValue={values?.contactEmail ?? ''}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="salaryMin">Salary minimum</Label>
          <Input
            id="salaryMin"
            name="salaryMin"
            type="number"
            required
            min={0}
            defaultValue={values?.salaryMin ?? ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salaryMax">Salary maximum</Label>
          <Input
            id="salaryMax"
            name="salaryMax"
            type="number"
            required
            min={0}
            defaultValue={values?.salaryMax ?? ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salaryCurrency">Currency</Label>
          <Input id="salaryCurrency" name="salaryCurrency" defaultValue={values?.salaryCurrency ?? 'USD'} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" rows={4} defaultValue={values?.description ?? ''} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Submitting…">Submit for review</SubmitButton>
    </form>
  )
}
