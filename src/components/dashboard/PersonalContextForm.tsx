'use client'

import { useActionState, useState } from 'react'
import { updatePersonalContext } from '@/app/dashboard/actions'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { ConfidenceSlider } from '@/components/onboarding/ConfidenceSlider'
import { MultiChoiceButtons } from '@/components/onboarding/MultiChoiceButtons'
import { BLOCKER_OPTIONS, MOTIVATIONS_OPTIONS, MOTIVATIONS_MAX } from '@/lib/constants/onboarding'
import { cn } from '@/lib/utils'
import type { CandidateProfile } from '@prisma/client'

const CONSISTENCY_LABELS = [
  'I start strong, then fall off',
  "I'm inconsistent, but I keep coming back",
  'I stay steady most weeks',
  'I show up every single week',
] as const

// Blockers + Motivations (Prisma CandidateProfile.blockers/motivations
// block) — this stays private between the candidate and their coach.
// Neither field ever appears in the Executive Dossier: blockers inform
// coaching only, and motivations calibrate Victoria's tone. See the
// "never in Dossier" header comment in dossier-sections.ts.
export function PersonalContextForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updatePersonalContext, undefined)
  const [blockers, setBlockers] = useState<string[]>(profile.blockers)
  const [motivations, setMotivations] = useState<string[]>(profile.motivations)

  return (
    <form
      action={formAction}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <p className="text-xs text-muted-foreground">
        This stays private between you and your coach — it never appears in your Executive Dossier,
        no matter what you select.
      </p>

      <div className="space-y-2">
        <Label>What tends to get in the way, if anything? Select all that apply.</Label>
        <MultiChoiceButtons name="blockers" options={BLOCKER_OPTIONS} value={blockers} onChange={setBlockers} columns={1} />
      </div>

      <ConfidenceSlider
        name="consistencySelfRating"
        label="How would you describe your consistency week to week?"
        defaultValue={profile.consistencySelfRating}
        labels={CONSISTENCY_LABELS}
      />

      <div className="space-y-2">
        <Label htmlFor="blockersOpenText">Anything more personal you want your coach to know? (optional)</Label>
        <Textarea
          id="blockersOpenText"
          name="blockersOpenText"
          defaultValue={profile.blockersOpenText ?? ''}
          placeholder="Only your coach sees this — it's never structured or shared anywhere else."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>
          What&apos;s driving your search right now? Select up to {MOTIVATIONS_MAX} — this helps your
          coach calibrate how they talk to you.
        </Label>
        <MultiChoiceButtons
          name="motivations"
          options={MOTIVATIONS_OPTIONS}
          value={motivations}
          onChange={setMotivations}
          columns={2}
          max={MOTIVATIONS_MAX}
        />
        <Textarea
          name="motivationsElaboration"
          defaultValue={profile.motivationsElaboration ?? ''}
          placeholder="In your own words (optional)"
          rows={3}
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
    </form>
  )
}
