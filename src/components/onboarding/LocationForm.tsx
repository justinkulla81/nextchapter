'use client'

import { useActionState, useState } from 'react'
import type { CandidateProfile } from '@prisma/client'
import { updateLocation } from '@/app/onboarding/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { LOCATION_PREFERENCE_OPTIONS } from '@/lib/constants/onboarding'

export function LocationForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateLocation, undefined)
  const [remotePreference, setRemotePreference] = useState<string | null>(profile.remotePreference)
  const [openToRelocation, setOpenToRelocation] = useState(profile.openToRelocation)

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

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton className="w-full">Continue</SubmitButton>
    </form>
  )
}
