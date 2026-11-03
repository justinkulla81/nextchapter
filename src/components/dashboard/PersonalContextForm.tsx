'use client'

import { useActionState, useState, type FormEvent } from 'react'
import { updatePersonalContext } from '@/app/dashboard/actions'
import { useAdvanceSearchStrategyPageOnSave } from '@/components/dashboard/SearchStrategyWizard'
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
import { posthog } from '@/lib/posthog/client'
import { MissingNote, MissingSummary, scrollToQuestion, type MissingQuestion } from '@/components/dashboard/RequiredQuestions'
import { PersonalizationQuestion } from '@/components/ui/personalization-question'
import { MoreDetails } from '@/components/dashboard/MoreDetails'
import type { CandidateProfile, CoachingStylePreference, ChangePacePreference, ChangeReadiness } from '@prisma/client'

const CONSISTENCY_LABELS = [
  'I start strong, then fall off',
  "I'm inconsistent, but I keep coming back",
  'I stay steady most weeks',
  'I show up every single week',
] as const

// "Not answered yet", in words, on a question this step needs. Same wording as
// the unanswered fields on the first step of this wizard.
function RequiredBadge({ show }: { show: boolean }) {
  if (!show) return null
  return <span className="text-sm text-muted-foreground">Not answered yet</span>
}

// Blockers and Motivations — the second of the two required buckets
// (alongside SearchStrategyForm) before Victoria drafts Search Strategy
// guidance, see isBlockersAndMotivationsComplete. This stays private between
// the candidate and their coach. None of these fields ever appear in the
// Executive Dossier: blockers/coaching-style/pace/readiness inform coaching
// only, and motivations calibrate Victoria's tone. See the "never in
// Dossier" header comment in dossier-sections.ts.
export function PersonalContextForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updatePersonalContext, undefined)
  useAdvanceSearchStrategyPageOnSave(pending, !!state?.error)
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
  // Set once a save is blocked; the notes then clear as each question is answered.
  const [showMissing, setShowMissing] = useState(false)

  // The five questions this step needs before it counts as done (see
  // isBlockersAndMotivationsComplete). The other four are optional.
  const missing: MissingQuestion[] = [
    ...(blockers.length === 0 ? [{ id: 'blockers-question', label: 'What tends to get in the way' }] : []),
    ...(motivations.length === 0 ? [{ id: 'motivations-question', label: 'What is driving your search' }] : []),
    ...(!coachingStylePreference ? [{ id: 'coaching-style-question', label: 'What kind of push works for you' }] : []),
    ...(!changePacePreference ? [{ id: 'change-pace-question', label: 'How you like to make progress' }] : []),
    ...(!changeReadiness ? [{ id: 'change-readiness-question', label: 'How much change you want' }] : []),
  ]
  const unanswered = (id: string) => missing.some((m) => m.id === `${id}-question`)

  // Stops the save before it is sent, so nothing picked or typed is lost. Without
  // this, a save with these blank was accepted and the step stayed unfinished
  // with no message.
  function blockSaveIfIncomplete(event: FormEvent<HTMLFormElement>) {
    if (missing.length === 0) return
    event.preventDefault()
    setShowMissing(true)
    posthog.capture('search_strategy_blockers_save_blocked', {
      candidateId: profile.id,
      missing: missing.map((m) => m.id.replace('-question', '')),
      missingCount: missing.length,
    })
    scrollToQuestion(missing[0].id)
  }

  return (
    <form
      action={formAction}
      onSubmit={blockSaveIfIncomplete}
      data-flags-missing
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <p className="text-xs text-muted-foreground">
        This stays private between you and your coach — it never appears in your Executive Dossier,
        no matter what you select. Victoria uses it to shape her guidance above and how she talks
        to you.
      </p>
      <p className="text-sm text-muted-foreground">
        These five are needed to finish this step. The four optional ones are below, and you can skip them.
      </p>

      <PersonalizationQuestion
        id="blockers"
        question="What tends to get in the way, if anything?"
        payoff="Victoria builds around what stalls you, so your plan is one you can finish. Select all that apply."
        badge={<RequiredBadge show={unanswered('blockers')} />}
      >
        <MultiChoiceButtons name="blockers" options={BLOCKER_OPTIONS} value={blockers} onChange={setBlockers} columns={2} />
        <MissingNote show={showMissing && unanswered('blockers')} />
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="motivations"
        question="What's driving your search right now?"
        payoff={`Your coach calibrates how they talk to you. Select up to ${MOTIVATIONS_MAX}.`}
        badge={<RequiredBadge show={unanswered('motivations')} />}
      >
        <MultiChoiceButtons
          name="motivations"
          options={MOTIVATIONS_OPTIONS}
          value={motivations}
          onChange={setMotivations}
          columns={2}
          max={MOTIVATIONS_MAX}
        />
        <MissingNote show={showMissing && unanswered('motivations')} />
        <Textarea
          name="motivationsElaboration"
          defaultValue={profile.motivationsElaboration ?? ''}
          placeholder="What gets you up in the morning? What helps you shift your attitude on a hard day? (optional, in your own words)"
          rows={3}
        />
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="coaching-style"
        question="When you're stuck, what kind of push works better for you?"
        payoff="Victoria coaches you in the style that gets you moving, instead of a generic pep talk."
        badge={<RequiredBadge show={unanswered('coaching-style')} />}
      >
        <ChoiceButtons
          name="coachingStylePreference"
          options={COACHING_STYLE_OPTIONS}
          value={coachingStylePreference}
          onChange={setCoachingStylePreference}
          columns={3}
        />
        <MissingNote show={showMissing && unanswered('coaching-style')} />
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="change-pace"
        question="How do you like to make progress?"
        payoff="Your weekly plan is sized to your pace, so it stays doable."
        badge={<RequiredBadge show={unanswered('change-pace')} />}
      >
        <ChoiceButtons
          name="changePacePreference"
          options={CHANGE_PACE_OPTIONS}
          value={changePacePreference}
          onChange={setChangePacePreference}
          columns={3}
        />
        <MissingNote show={showMissing && unanswered('change-pace')} />
      </PersonalizationQuestion>

      <PersonalizationQuestion
        id="change-readiness"
        question="Are you looking for a big change, or more of the same?"
        payoff="Your job and pivot suggestions lean toward how much change you actually want."
        badge={<RequiredBadge show={unanswered('change-readiness')} />}
      >
        <ChoiceButtons
          name="changeReadiness"
          options={CHANGE_READINESS_OPTIONS}
          value={changeReadiness}
          onChange={setChangeReadiness}
          columns={1}
        />
        <MissingNote show={showMissing && unanswered('change-readiness')} />
      </PersonalizationQuestion>

      <MoreDetails summary="Four optional questions">
        <PersonalizationQuestion
          id="search-difficulty"
          question="How difficult has your job search been so far?"
          payoff="Victoria adjusts how much support and encouragement she gives you."
          optional
        >
          <FourStopSlider
            name="jobSearchDifficultyLevel"
            choices={JOB_SEARCH_DIFFICULTY_OPTIONS}
            defaultValue={jobSearchDifficultyLevel}
            onChange={setJobSearchDifficultyLevel}
          />
        </PersonalizationQuestion>

        <PersonalizationQuestion
          id="biggest-barriers"
          question="What do you think are the biggest barriers to getting a new job?"
          payoff="Your Search Strategy guidance goes after the barriers you name first. Select all that apply."
          optional
        >
          <MultiChoiceButtons
            name="biggestBarriers"
            options={BIGGEST_BARRIER_OPTIONS}
            value={biggestBarriers}
            onChange={setBiggestBarriers}
            columns={2}
          />
        </PersonalizationQuestion>

        <ConfidenceSlider
          name="consistencySelfRating"
          label="How would you describe your consistency week to week?"
          payoff="Your weekly plan is sized to how consistent you really are."
          optional
          defaultValue={profile.consistencySelfRating}
          labels={CONSISTENCY_LABELS}
        />

        <PersonalizationQuestion
          id="personal-notes"
          htmlFor="blockersOpenText"
          question="Anything more personal you want your coach to know?"
          payoff="Your coach sees it and nobody else does. It is never structured or shared anywhere else."
          optional
        >
          <Textarea
            id="blockersOpenText"
            name="blockersOpenText"
            defaultValue={profile.blockersOpenText ?? ''}
            placeholder="Only your coach sees this."
            rows={3}
          />
        </PersonalizationQuestion>
      </MoreDetails>

      <MissingSummary show={showMissing} missing={missing} />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
    </form>
  )
}
