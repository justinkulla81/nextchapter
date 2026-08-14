'use client'

import { useActionState, useState } from 'react'
import type { CandidateProfile, NetworkComfortLevel } from '@prisma/client'
import { updateComfort } from '@/app/onboarding/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'

const NETWORK_COMFORT_OPTIONS: { value: NetworkComfortLevel; label: string }[] = [
  { value: 'VERY_COMFORTABLE', label: 'Very comfortable' },
  { value: 'SOMEWHAT_COMFORTABLE', label: 'Somewhat comfortable' },
  { value: 'NOT_VERY_COMFORTABLE', label: 'Not very comfortable' },
  { value: 'RATHER_NOT', label: "I'd rather not" },
]

export function ComfortForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateComfort, undefined)
  const [networkComfortLevel, setNetworkComfortLevel] = useState<NetworkComfortLevel | null>(
    profile.networkComfortLevel
  )

  return (
    <form
      action={formAction}
      className={`w-full max-w-xl space-y-5 ${pending ? 'cursor-progress [&_*]:cursor-progress' : ''}`}
    >
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
