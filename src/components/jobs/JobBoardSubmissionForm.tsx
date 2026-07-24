'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import {
  AUDIENCE_TIER_OPTIONS,
  DISTRIBUTION_OPTIONS,
  DISTRIBUTION_OPTIONS_WITH_EXCLUDED,
  DISCLOSURE_OPTIONS,
  TARGET_REMOTE_POLICY_OPTIONS,
} from '@/lib/jobs/job-board-visibility'
import { PRIMARY_FUNCTION_OPTIONS, HIGHEST_LEVEL_OPTIONS } from '@/lib/constants/onboarding'
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
  audienceTier?: string
  distribution?: string
  disclosure?: string
  targetFunction?: string
  targetLevel?: string
  targetLocation?: string
  targetRemotePolicy?: string
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
  allowExcluded = false,
  allowDisclosure = false,
}: {
  action: (prevState: JobBoardSubmitState, formData: FormData) => Promise<JobBoardSubmitState>
  // Recruiter-only capabilities — everyone else (Hiring Manager, NC/admin)
  // only ever gets Open/Targeted distribution and a company-named listing.
  allowExcluded?: boolean
  allowDisclosure?: boolean
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [postingType, setPostingType] = useState<'direct' | 'recruiter_search' | null>(
    (state?.values?.postingType as 'direct' | 'recruiter_search' | undefined) ?? null
  )
  const values = state?.values
  const [audienceTier, setAudienceTier] = useState<'ALL_CANDIDATES' | 'A_LIST_ONLY' | null>(
    (values?.audienceTier as 'ALL_CANDIDATES' | 'A_LIST_ONLY' | undefined) ?? 'A_LIST_ONLY'
  )
  const [distribution, setDistribution] = useState<'OPEN' | 'TARGETED' | 'EXCLUDED' | null>(
    (values?.distribution as 'OPEN' | 'TARGETED' | 'EXCLUDED' | undefined) ?? 'OPEN'
  )
  const [disclosure, setDisclosure] = useState<'OPEN' | 'CONFIDENTIAL' | null>(
    (values?.disclosure as 'OPEN' | 'CONFIDENTIAL' | undefined) ?? 'OPEN'
  )
  const [targetRemotePolicy, setTargetRemotePolicy] = useState<'onsite' | 'remote' | 'hybrid' | null>(
    (values?.targetRemotePolicy as 'onsite' | 'remote' | 'hybrid' | undefined) ?? null
  )

  if (state?.success) {
    return (
      <div className="rounded-lg border border-brand/30 bg-brand/5 p-4 text-sm text-foreground">
        Submitted for review — you&apos;ll hear back once it&apos;s approved. Every listing on the
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

      <div className="space-y-4 rounded-lg border border-border bg-off-white/50 p-4">
        <div className="space-y-2">
          <Label>Who can see this listing?</Label>
          <ChoiceButtons
            name="audienceTier"
            options={AUDIENCE_TIER_OPTIONS}
            value={audienceTier}
            onChange={setAudienceTier}
            responsive
          />
        </div>

        <div className="space-y-2">
          <Label>Distribution</Label>
          <ChoiceButtons
            name="distribution"
            options={allowExcluded ? DISTRIBUTION_OPTIONS_WITH_EXCLUDED : DISTRIBUTION_OPTIONS}
            value={distribution}
            onChange={setDistribution}
            responsive
          />
        </div>

        {allowDisclosure && (
          <div className="space-y-2">
            <Label>Company name</Label>
            <ChoiceButtons
              name="disclosure"
              options={DISCLOSURE_OPTIONS}
              value={disclosure}
              onChange={setDisclosure}
              responsive
            />
          </div>
        )}

        {distribution === 'TARGETED' && (
          <div className="space-y-4 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Only shown to candidates who fit this — leave any of these blank to not filter on it.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetFunction">Function</Label>
                <select
                  id="targetFunction"
                  name="targetFunction"
                  defaultValue={values?.targetFunction ?? ''}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Any</option>
                  {PRIMARY_FUNCTION_OPTIONS.map((fn) => (
                    <option key={fn} value={fn}>
                      {fn}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetLevel">Level</Label>
                <select
                  id="targetLevel"
                  name="targetLevel"
                  defaultValue={values?.targetLevel ?? ''}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Any</option>
                  {HIGHEST_LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetLocation">Location (optional filter)</Label>
              <Input id="targetLocation" name="targetLocation" defaultValue={values?.targetLocation ?? ''} />
            </div>
            <div className="space-y-2">
              <Label>Remote policy</Label>
              <ChoiceButtons
                name="targetRemotePolicy"
                options={TARGET_REMOTE_POLICY_OPTIONS}
                value={targetRemotePolicy}
                onChange={setTargetRemotePolicy}
                responsive
              />
            </div>
          </div>
        )}
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Submitting…">Submit for review</SubmitButton>
    </form>
  )
}
