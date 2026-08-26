'use client'

import { useActionState, useState } from 'react'
import type { CandidateProfile, GapDurationBucket, NetworkComfortLevel } from '@prisma/client'
import { updateLocationAndSearchStatus } from '@/app/onboarding/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { LOCATION_PREFERENCE_OPTIONS, GAP_DURATION_LABELS, AI_DISPLACEMENT_OPTIONS } from '@/lib/constants/onboarding'

const GAP_DURATION_OPTIONS = (Object.entries(GAP_DURATION_LABELS) as [GapDurationBucket, string][]).map(
  ([value, label]) => ({ value, label })
)

const NETWORK_COMFORT_OPTIONS: { value: NetworkComfortLevel; label: string }[] = [
  { value: 'VERY_COMFORTABLE', label: 'Very comfortable' },
  { value: 'SOMEWHAT_COMFORTABLE', label: 'Somewhat comfortable' },
  { value: 'NOT_VERY_COMFORTABLE', label: 'Not very comfortable' },
  { value: 'RATHER_NOT', label: "I'd rather not" },
]

export function LocationForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateLocationAndSearchStatus, undefined)
  const [remotePreference, setRemotePreference] = useState<string | null>(profile.remotePreference)
  const [openToRelocation, setOpenToRelocation] = useState(profile.openToRelocation)
  const [travelWillingness, setTravelWillingness] = useState(profile.travelWillingness)
  const [justStartedSearch, setJustStartedSearch] = useState(profile.justStartedSearch)
  const [gapDuration, setGapDuration] = useState<GapDurationBucket | null>(profile.gapDuration)
  const [aiDisplacementReason, setAiDisplacementReason] = useState<string | null>(profile.aiDisplacementReason)
  const [networkComfortLevel, setNetworkComfortLevel] = useState<NetworkComfortLevel | null>(
    profile.networkComfortLevel
  )

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

      <div className="flex items-center gap-2">
        <Checkbox
          id="travelWillingness"
          name="travelWillingness"
          value="on"
          defaultChecked={travelWillingness}
          onCheckedChange={(checked) => setTravelWillingness(checked === true)}
        />
        <Label htmlFor="travelWillingness" className="font-normal">
          I&apos;m willing to travel for a role (not the same as relocating)
        </Label>
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

      <div className="space-y-2">
        <Label>
          Was AI part of why your last role ended? <span className="text-muted-foreground">(optional)</span>
        </Label>
        <ChoiceButtons
          name="aiDisplacementReason"
          options={AI_DISPLACEMENT_OPTIONS}
          value={aiDisplacementReason as (typeof AI_DISPLACEMENT_OPTIONS)[number]['value'] | null}
          onChange={setAiDisplacementReason}
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="jobsAppliedCount">How many roles have you applied to?</Label>
            <Input id="jobsAppliedCount" name="jobsAppliedCount" type="number" min={0} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interviewsCount">How many interviews have you had?</Label>
            <Input
              id="interviewsCount"
              name="interviewsCount"
              type="number"
              min={0}
              defaultValue={profile.interviewsReceivedCount ?? ''}
            />
          </div>
        </div>
      )}

      <div className="border-t border-border pt-5">
        <h2 className="text-sm font-semibold text-foreground">One more thing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          How comfortable do you feel letting your network know you&apos;re looking for a role?
        </p>
      </div>

      <ChoiceButtons
        name="networkComfortLevel"
        options={NETWORK_COMFORT_OPTIONS}
        value={networkComfortLevel}
        onChange={setNetworkComfortLevel}
        columns={2}
        responsive
      />

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton className="w-full">Continue</SubmitButton>
    </form>
  )
}
