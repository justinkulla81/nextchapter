'use client'

import { useActionState, useState } from 'react'
import { updateSkillsAssessment } from '@/app/dashboard/skills-assessment/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { ConfidenceSlider } from '@/components/onboarding/ConfidenceSlider'
import { MultiChoiceButtons } from '@/components/onboarding/MultiChoiceButtons'
import { TOP_STRENGTH_OPTIONS, TOP_STRENGTHS_MAX } from '@/lib/constants/onboarding'
import { cn } from '@/lib/utils'
import type { CandidateProfile } from '@prisma/client'

const CORE_SKILL_LABELS = [
  'Just getting started',
  'Still building skills',
  'Very strong',
  'Among the best in my field',
] as const

const MANAGEMENT_LABELS = [
  "I haven't had much experience",
  'I prefer to be an individual contributor',
  'I like managing people',
  "It's my favorite thing",
] as const

export function SkillsAssessmentForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateSkillsAssessment, undefined)
  // Asked from Track Record now (spec §4.2 item 16), not here — this just
  // reads the value Track Record wrote to gate the management-confidence
  // slider below, rather than asking it again.
  const isPeopleManager = profile.isPeopleManager
  const [topStrengths, setTopStrengths] = useState<string[]>(profile.topStrengths)

  const functionLabel = profile.resumeLatestJobTitle ?? profile.primaryFunction

  return (
    <form
      action={formAction}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label>
          Every great candidate is exceptional at a few things rather than good at everything.
          Select up to {TOP_STRENGTHS_MAX} strengths that best describe where you truly stand out.
        </Label>
        <MultiChoiceButtons
          name="topStrengths"
          options={TOP_STRENGTH_OPTIONS}
          value={topStrengths}
          onChange={setTopStrengths}
          columns={2}
          max={TOP_STRENGTHS_MAX}
        />
      </div>

      <ConfidenceSlider
        name="functionSkillConfidence"
        label={
          functionLabel
            ? `How confident are you in your core job function (as a ${functionLabel})?`
            : 'How confident are you in your core job function skills?'
        }
        defaultValue={profile.functionSkillConfidence}
        labels={CORE_SKILL_LABELS}
      />

      <ConfidenceSlider
        name="aiFlexibilityLevel"
        label="How confident are you in your AI skills?"
        defaultValue={profile.aiFlexibilityLevel}
        labels={CORE_SKILL_LABELS}
      />

      {isPeopleManager && (
        <ConfidenceSlider
          name="managementSkillConfidence"
          label="How confident are you in your management skills?"
          defaultValue={profile.managementSkillConfidence}
          labels={MANAGEMENT_LABELS}
        />
      )}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Saving…">Save Skills Inventory</SubmitButton>
    </form>
  )
}
