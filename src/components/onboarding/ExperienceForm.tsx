'use client'

import { useActionState, useState } from 'react'
import { updateExperience } from '@/app/onboarding/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfidenceSlider } from './ConfidenceSlider'
import { cn } from '@/lib/utils'
import type { CandidateProfile } from '@prisma/client'

// Core job-function/AI skills go all the way to "best in my field" — these
// are the kind of skills people can confidently self-assess as elite.
const CORE_SKILL_LABELS = [
  'Just getting started',
  'Still building skills',
  'Very strong',
  'Among the best in my field',
] as const

const ACTION_ORIENTED_LABELS = [
  'Easy going',
  'I do what is asked of me',
  'I like to be first and on top of it',
  'I like to do things without being told, even if it means more work for me',
] as const

const CREATIVITY_LABELS = [
  'I prefer when things are clearly mapped out',
  'I like things well-defined, with a little room to adapt',
  'I like the freedom to be creative',
  'I thrive when I have no boundaries',
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

export function ExperienceForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateExperience, undefined)
  const [isPeopleManager, setIsPeopleManager] = useState<boolean | null>(profile.isPeopleManager)

  return (
    <form
      action={formAction}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label>Have you been a people manager?</Label>
        <input type="hidden" name="isPeopleManager" value={isPeopleManager === null ? '' : isPeopleManager ? 'yes' : 'no'} />
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: true, label: 'Yes' },
            { value: false, label: 'No' },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => setIsPeopleManager(opt.value)}
              aria-pressed={isPeopleManager === opt.value}
              className={cn(
                'rounded-lg border-2 p-3 text-center text-sm font-medium transition-colors',
                isPeopleManager === opt.value
                  ? 'border-brand bg-brand/5 text-brand'
                  : 'border-border bg-white text-foreground hover:border-brand/40'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
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
        label="How confident are you in your core job function skills?"
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

      <Button type="submit" disabled={pending}>
        {pending ? 'Processing your answers…' : 'Continue'}
      </Button>
    </form>
  )
}
