'use client'

import { useActionState, useState } from 'react'
import type { CandidateProfile, GapDurationBucket } from '@prisma/client'
import { updateLocationAndSearchStatus } from '@/app/onboarding/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { LOCATION_PREFERENCE_OPTIONS, GAP_DURATION_LABELS } from '@/lib/constants/onboarding'

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

export function LocationForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateLocationAndSearchStatus, undefined)
  const [remotePreference, setRemotePreference] = useState<string | null>(profile.remotePreference)
  const [openToRelocation, setOpenToRelocation] = useState(profile.openToRelocation)
  const [justStartedSearch, setJustStartedSearch] = useState(profile.justStartedSearch)
  const [gapDuration, setGapDuration] = useState<GapDurationBucket | null>(profile.gapDuration)
  const [applicationsBucket, setApplicationsBucket] = useState<string | null>(profile.applicationsBucket)
  const [interviewsBucket, setInterviewsBucket] = useState<string | null>(profile.interviewsBucket)

  return (
    <form
      action={formAction}
      className={`w-full max-w-xl space-y-5 text-left ${pending ? 'cursor-progress [&_*]:cursor-progress' : ''}`}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="currentCity">City</Label>
          <Input id="currentCity" name="currentCity" defaultValue={profile.currentCity ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentState">State</Label>
          <Input id="currentState" name="currentState" defaultValue={profile.currentState ?? ''} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Work-location preference</Label>
        <ChoiceButtons
          name="remotePreference"
          options={LOCATION_PREFERENCE_OPTIONS}
          value={remotePreference as (typeof LOCATION_PREFERENCE_OPTIONS)[number]['value'] | null}
          onChange={setRemotePreference}
          responsive
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="openToRelocation"
            name="openToRelocation"
            value="on"
            defaultChecked={openToRelocation}
            onCheckedChange={(checked) => setOpenToRelocation(checked === true)}
          />
          <Label htmlFor="openToRelocation" className="font-normal">
            I&apos;m open to relocating for the right role
          </Label>
        </div>
        {openToRelocation && (
          <Textarea
            name="relocationNotes"
            defaultValue={profile.relocationNotes ?? ''}
            placeholder="Any constraints or preferred cities?"
            rows={2}
          />
        )}
      </div>

      <div className="border-t border-border pt-5">
        <h2 className="text-sm font-semibold text-foreground">Where are you in your search?</h2>
        <p className="mt-1 text-sm text-muted-foreground">This tells us which part of the process to focus on first.</p>
      </div>

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
