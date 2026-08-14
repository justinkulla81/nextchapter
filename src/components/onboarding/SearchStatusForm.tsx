'use client'

import { useActionState, useState } from 'react'
import type { CandidateProfile, GapDurationBucket } from '@prisma/client'
import { updateSearchStatus } from '@/app/onboarding/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { GAP_DURATION_LABELS } from '@/lib/constants/onboarding'

const GAP_DURATION_OPTIONS = (Object.entries(GAP_DURATION_LABELS) as [GapDurationBucket, string][]).map(
  ([value, label]) => ({ value, label })
)

const APPLICATIONS_OPTIONS = [
  { value: 'none', label: 'None yet' },
  { value: 'under_10', label: 'Under 10' },
  { value: '10_50', label: '10-50' },
  { value: '50_plus', label: '50+' },
] as const

const INTERVIEWS_OPTIONS = [
  { value: 'none', label: 'None yet' },
  { value: 'a_few', label: 'A few' },
  { value: 'several', label: 'Several' },
  { value: 'late_stages', label: 'In late stages' },
] as const

export function SearchStatusForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateSearchStatus, undefined)
  const [justStartedSearch, setJustStartedSearch] = useState(profile.justStartedSearch)
  const [gapDuration, setGapDuration] = useState<GapDurationBucket | null>(profile.gapDuration)
  const [applicationsBucket, setApplicationsBucket] = useState<string | null>(profile.applicationsBucket)
  const [interviewsBucket, setInterviewsBucket] = useState<string | null>(profile.interviewsBucket)

  return (
    <form
      action={formAction}
      className={`w-full max-w-xl space-y-5 text-left ${pending ? 'cursor-progress [&_*]:cursor-progress' : ''}`}
    >
      <div className="space-y-2">
        <Label>How long have you been searching?</Label>
        <ChoiceButtons
          name="gapDuration"
          options={GAP_DURATION_OPTIONS}
          value={gapDuration}
          onChange={setGapDuration}
          responsive
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="justStartedSearch"
          name="justStartedSearch"
          value="on"
          defaultChecked={justStartedSearch}
          onCheckedChange={(checked) => setJustStartedSearch(checked === true)}
        />
        <Label htmlFor="justStartedSearch" className="font-normal">
          I just started my search — no applications or interviews yet
        </Label>
      </div>

      {!justStartedSearch && (
        <>
          <div className="space-y-2">
            <Label>How many roles have you applied to?</Label>
            <ChoiceButtons
              name="applicationsBucket"
              options={APPLICATIONS_OPTIONS}
              value={applicationsBucket as (typeof APPLICATIONS_OPTIONS)[number]['value'] | null}
              onChange={setApplicationsBucket}
              responsive
            />
          </div>

          <div className="space-y-2">
            <Label>How many interviews have you had?</Label>
            <ChoiceButtons
              name="interviewsBucket"
              options={INTERVIEWS_OPTIONS}
              value={interviewsBucket as (typeof INTERVIEWS_OPTIONS)[number]['value'] | null}
              onChange={setInterviewsBucket}
              responsive
            />
          </div>
        </>
      )}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton className="w-full">Continue</SubmitButton>
    </form>
  )
}
