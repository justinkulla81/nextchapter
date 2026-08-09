'use client'

import { useActionState, useState } from 'react'
import { updateSkillsAssessment } from '@/app/dashboard/skills-assessment/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfidenceSlider } from '@/components/onboarding/ConfidenceSlider'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { MultiChoiceButtons } from '@/components/onboarding/MultiChoiceButtons'
import { TOP_STRENGTH_OPTIONS, TOP_STRENGTHS_MAX, CREATIVITY_LABELS } from '@/lib/constants/onboarding'
import { cn } from '@/lib/utils'
import type { CandidateProfile } from '@prisma/client'

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

const CORE_SKILL_LABELS = [
  'Just getting started',
  'Still building skills',
  'Very strong',
  'Among the best in my field',
] as const

const ACTION_ORIENTED_LABELS = [
  "I'm easy going on this",
  'I do what is asked of me',
  'I like to be first and on top of it',
  'I like to do things without being told, even if it means more work for me',
] as const

const COMMUNICATOR_LABELS = [
  'I am very reserved',
  "I'll express myself when asked",
  "I'm social — I'm most comfortable when I can express myself",
  "I love communicating — it's one of my strengths",
] as const

const MANAGEMENT_LABELS = [
  "I haven't had much experience",
  'I prefer to be an individual contributor',
  'I like managing people',
  "It's my favorite thing",
] as const

export function SkillsAssessmentForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateSkillsAssessment, undefined)
  const [isPeopleManager, setIsPeopleManager] = useState<boolean | null>(profile.isPeopleManager)
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

      <div className="space-y-2">
        <Label>Have you been a people manager?</Label>
        <ChoiceButtons
          name="isPeopleManager"
          options={YES_NO_OPTIONS}
          value={isPeopleManager === null ? null : isPeopleManager ? 'yes' : 'no'}
          onChange={(value) => setIsPeopleManager(value === 'yes')}
          columns={2}
        />
      </div>

      {isPeopleManager && (
        <div className="space-y-2">
          <Label htmlFor="teamSizeManaged">Largest team you managed</Label>
          <Input
            id="teamSizeManaged"
            name="teamSizeManaged"
            type="number"
            min={0}
            defaultValue={profile.teamSizeManaged ?? undefined}
          />
        </div>
      )}

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

      <ConfidenceSlider
        name="actionOrientedConfidence"
        label="How action-oriented are you?"
        defaultValue={profile.actionOrientedConfidence}
        labels={ACTION_ORIENTED_LABELS}
      />

      <ConfidenceSlider
        name="creativityConfidence"
        label="How creative are you?"
        defaultValue={profile.creativityConfidence}
        labels={CREATIVITY_LABELS}
      />

      <ConfidenceSlider
        name="communicatorConfidence"
        label="How strong a communicator are you?"
        defaultValue={profile.communicatorConfidence}
        labels={COMMUNICATOR_LABELS}
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

      <SubmitButton pendingLabel="Saving…">Save Skills Assessment</SubmitButton>
    </form>
  )
}
