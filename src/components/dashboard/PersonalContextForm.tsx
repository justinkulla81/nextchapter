'use client'

import { useActionState, useState } from 'react'
import { updatePersonalContext } from '@/app/dashboard/actions'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { ConfidenceSlider } from '@/components/onboarding/ConfidenceSlider'
import { MultiChoiceButtons } from '@/components/onboarding/MultiChoiceButtons'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { FourStopSlider } from '@/components/onboarding/FourStopSlider'
import {
  BLOCKER_OPTIONS,
  MOTIVATIONS_OPTIONS,
  MOTIVATIONS_MAX,
  COACHING_STYLE_OPTIONS,
  CHANGE_PACE_OPTIONS,
  CHANGE_READINESS_OPTIONS,
  JOB_SEARCH_DIFFICULTY_OPTIONS,
  BIGGEST_BARRIER_OPTIONS,
} from '@/lib/constants/onboarding'
import { cn } from '@/lib/utils'
import type { CandidateProfile, CoachingStylePreference, ChangePacePreference, ChangeReadiness } from '@prisma/client'

const CONSISTENCY_LABELS = [
  'I start strong, then fall off',
  "I'm inconsistent, but I keep coming back",
  'I stay steady most weeks',
  'I show up every single week',
] as const

// Blockers and Motivations — the second of the two required buckets
// (alongside SearchStrategyForm) before Victoria drafts Search Strategy
// guidance, see isBlockersAndMotivationsComplete. This stays private between
// the candidate and their coach. None of these fields ever appear in the
// Executive Dossier: blockers/coaching-style/pace/readiness inform coaching
// only, and motivations calibrate Victoria's tone. See the "never in
// Dossier" header comment in dossier-sections.ts.
export function PersonalContextForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updatePersonalContext, undefined)
  const [jobSearchDifficultyLevel, setJobSearchDifficultyLevel] = useState<number | null>(
    profile.jobSearchDifficultyLevel
  )
  const [biggestBarriers, setBiggestBarriers] = useState<string[]>(profile.biggestBarriers)
  const [blockers, setBlockers] = useState<string[]>(profile.blockers)
  const [motivations, setMotivations] = useState<string[]>(profile.motivations)
  const [coachingStylePreference, setCoachingStylePreference] = useState<CoachingStylePreference | null>(
    profile.coachingStylePreference
  )
  const [changePacePreference, setChangePacePreference] = useState<ChangePacePreference | null>(
    profile.changePacePreference
  )
  const [changeReadiness, setChangeReadiness] = useState<ChangeReadiness | null>(profile.changeReadiness)

  return (
    <form
      action={formAction}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <p className="text-xs text-muted-foreground">
        This stays private between you and your coach — it never appears in your Executive Dossier,
        no matter what you select. Victoria uses it to shape her guidance above and how she talks
        to you.
      </p>

      <div className="space-y-2">
        <Label>How difficult has your job search been so far?</Label>
        <FourStopSlider
          name="jobSearchDifficultyLevel"
          choices={JOB_SEARCH_DIFFICULTY_OPTIONS}
          defaultValue={jobSearchDifficultyLevel}
          onChange={setJobSearchDifficultyLevel}
        />
      </div>

      <div className="space-y-2">
        <Label>What do you think are the biggest barriers to getting a new job? Select all that apply.</Label>
        <MultiChoiceButtons
          name="biggestBarriers"
          options={BIGGEST_BARRIER_OPTIONS}
          value={biggestBarriers}
          onChange={setBiggestBarriers}
          columns={2}
        />
      </div>

      <div className="space-y-2">
        <Label>What tends to get in the way, if anything? Select all that apply.</Label>
        <MultiChoiceButtons name="blockers" options={BLOCKER_OPTIONS} value={blockers} onChange={setBlockers} columns={2} />
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
          placeholder="What gets you up in the morning? What helps you shift your attitude on a hard day? (optional, in your own words)"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>When you&apos;re stuck, what kind of push works better for you?</Label>
        <ChoiceButtons
          name="coachingStylePreference"
          options={COACHING_STYLE_OPTIONS}
          value={coachingStylePreference}
          onChange={setCoachingStylePreference}
          columns={3}
        />
      </div>

      <div className="space-y-2">
        <Label>How do you like to make progress?</Label>
        <ChoiceButtons
          name="changePacePreference"
          options={CHANGE_PACE_OPTIONS}
          value={changePacePreference}
          onChange={setChangePacePreference}
          columns={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Are you looking for a big change, or more of the same?</Label>
        <ChoiceButtons
          name="changeReadiness"
          options={CHANGE_READINESS_OPTIONS}
          value={changeReadiness}
          onChange={setChangeReadiness}
          columns={1}
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
    </form>
  )
}
