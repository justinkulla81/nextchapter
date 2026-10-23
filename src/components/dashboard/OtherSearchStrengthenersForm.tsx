'use client'

import { useActionState, useState, type FormEvent } from 'react'
import { updateOtherSearchStrengtheners } from '@/app/dashboard/search-strategy/actions'
import { useAdvanceSearchStrategyPageOnSave } from '@/components/dashboard/SearchStrategyWizard'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { cn } from '@/lib/utils'
import {
  IndependentWorkExperienceQuestion,
  initialIndependentWorkAnswers,
} from '@/components/dashboard/IndependentWorkExperienceQuestion'
import { posthog } from '@/lib/posthog/client'
import {
  MissingNote,
  MissingSummary,
  scrollToQuestion,
  type MissingQuestion,
} from '@/components/dashboard/RequiredQuestions'
import {
  INDEPENDENT_WORK_TYPES,
  type IndependentWorkExperience,
  type IndependentWorkStatus,
  type IndependentWorkSuggestions,
  type IndependentWorkType,
} from '@/lib/independent-work/experience'

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

const NETWORKING_LEVEL_OPTIONS = [
  { value: '1', label: 'Not much' },
  { value: '2', label: 'Some, but I should do more' },
  { value: '3', label: 'A lot' },
  { value: '4', label: "I can't do more" },
] as const

const LEARNED_NEW_SKILLS_OPTIONS = [
  { value: '1', label: 'Not yet' },
  { value: '2', label: 'A little' },
  { value: '3', label: 'Yes, actively' },
] as const

function yesNoToString(value: boolean | null) {
  return value === true ? 'yes' : value === false ? 'no' : ''
}

// Board Advisory Work Willingness and the "so far" optional questions share
// one wizard page — one form, one save action, one Save button. See
// MarketingNetworkingForm's own comment for why combining the save doesn't
// change either question set's own semantics (Board Advisory Work still
// unlocks its own page the moment it's answered).
export function OtherSearchStrengthenersForm({
  candidateId,
  boardAdvisoryInitial,
  optionalQuestionsInitial,
  independentWorkInitial,
  independentWorkSuggestions,
}: {
  candidateId: string
  boardAdvisoryInitial: boolean | null
  independentWorkInitial: IndependentWorkExperience
  independentWorkSuggestions: IndependentWorkSuggestions
  optionalQuestionsInitial?: {
    networkingLevel: number | null
    learnedNewSkillsLevel: number | null
    triedExecutiveCoaching: boolean | null
    connectedWithRecruiters: boolean | null
    recruiterConnectionCount: number | null
  }
}) {
  const [state, formAction, pending] = useActionState(updateOtherSearchStrengtheners, undefined)
  useAdvanceSearchStrategyPageOnSave(pending, !!state?.error)

  const [boardAdvisoryAnswer, setBoardAdvisoryAnswer] = useState<'yes' | 'no' | null>(
    boardAdvisoryInitial === null ? null : boardAdvisoryInitial ? 'yes' : 'no'
  )
  const [networkingLevel, setNetworkingLevel] = useState(optionalQuestionsInitial?.networkingLevel?.toString() ?? '')
  const [learnedNewSkillsLevel, setLearnedNewSkillsLevel] = useState(
    optionalQuestionsInitial?.learnedNewSkillsLevel?.toString() ?? ''
  )
  const [triedExecutiveCoaching, setTriedExecutiveCoaching] = useState(
    yesNoToString(optionalQuestionsInitial?.triedExecutiveCoaching ?? null)
  )
  const [connectedWithRecruiters, setConnectedWithRecruiters] = useState(
    yesNoToString(optionalQuestionsInitial?.connectedWithRecruiters ?? null)
  )

  const [independentWork, setIndependentWork] = useState(() =>
    initialIndependentWorkAnswers(independentWorkInitial, independentWorkSuggestions)
  )
  // Set once a save is blocked for a missing answer; the per-question messages
  // then clear as each one is answered.
  const [showMissing, setShowMissing] = useState(false)

  // Every question on this page is required. Listed in page order so the
  // first one is the one we scroll to.
  const missing: MissingQuestion[] = [
    ...(boardAdvisoryAnswer === null ? [{ id: 'question-board-advisory', label: 'Board advisory work' }] : []),
    ...(networkingLevel === '' ? [{ id: 'question-networking', label: 'How much you have been networking' }] : []),
    ...(learnedNewSkillsLevel === ''
      ? [{ id: 'question-learning', label: 'Whether you have used your time to learn new skills' }]
      : []),
    ...INDEPENDENT_WORK_TYPES.filter(({ key }) => independentWork[key] === null).map(({ key, label }) => ({
      id: `question-independent-${key}`,
      label,
    })),
    ...(triedExecutiveCoaching === '' ? [{ id: 'question-coaching', label: 'Executive coaching' }] : []),
    ...(connectedWithRecruiters === '' ? [{ id: 'question-recruiters', label: 'Recruiters' }] : []),
  ]

  // Keeps whatever was already answered: the form is not submitted, so nothing
  // is cleared or re-rendered from the server.
  function blockSaveIfIncomplete(event: FormEvent<HTMLFormElement>) {
    if (missing.length === 0) return
    event.preventDefault()
    setShowMissing(true)
    posthog.capture('search_strategy_other_ways_save_blocked', {
      candidateId,
      missing: missing.map((m) => m.id.replace('question-', '')),
      missingCount: missing.length,
    })
    scrollToQuestion(missing[0].id)
  }

  return (
    <form
      action={formAction}
      onSubmit={blockSaveIfIncomplete}
      className={cn('space-y-8', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <p className="text-sm text-muted-foreground">Every question on this page is needed to save it.</p>

      <div id="question-board-advisory" className="scroll-mt-24 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Board Advisory Work Willingness</h3>
        <Label>
          Are you willing to take unpaid board positions to fill in resume gaps, keep skills current,
          and build new experience?
        </Label>
        <ChoiceButtons
          name="answer"
          options={YES_NO_OPTIONS}
          value={boardAdvisoryAnswer}
          onChange={setBoardAdvisoryAnswer}
          columns={2}
        />
        <MissingNote show={showMissing && boardAdvisoryAnswer === null} />
      </div>

      <div className="space-y-5 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">A Few More Details</h3>

        <div id="question-networking" className="scroll-mt-24 space-y-2">
          <Label>How much have you been networking?</Label>
          <ChoiceButtons
            name="networkingLevel"
            options={NETWORKING_LEVEL_OPTIONS}
            value={networkingLevel || null}
            onChange={setNetworkingLevel}
            columns={4}
          />
          <MissingNote show={showMissing && networkingLevel === ''} />
        </div>

        <div id="question-learning" className="scroll-mt-24 space-y-2">
          <Label>Have you used your time to learn new skills?</Label>
          <ChoiceButtons
            name="learnedNewSkillsLevel"
            options={LEARNED_NEW_SKILLS_OPTIONS}
            value={learnedNewSkillsLevel || null}
            onChange={setLearnedNewSkillsLevel}
            columns={3}
          />
          <MissingNote show={showMissing && learnedNewSkillsLevel === ''} />
        </div>

        <IndependentWorkExperienceQuestion
          answers={independentWork}
          onChange={(type: IndependentWorkType, value: IndependentWorkStatus) =>
            setIndependentWork((prev) => ({ ...prev, [type]: value }))
          }
          suggestions={independentWorkSuggestions}
          showMissing={showMissing}
        />

        <div id="question-coaching" className="scroll-mt-24 space-y-2">
          <Label>Have you tried Executive Coaching?</Label>
          <ChoiceButtons
            name="triedExecutiveCoaching"
            options={YES_NO_OPTIONS}
            value={triedExecutiveCoaching || null}
            onChange={setTriedExecutiveCoaching}
            columns={2}
          />
          <MissingNote show={showMissing && triedExecutiveCoaching === ''} />
        </div>

        <div id="question-recruiters" className="scroll-mt-24 space-y-2">
          <Label>Have you connected with recruiters?</Label>
          <ChoiceButtons
            name="connectedWithRecruiters"
            options={YES_NO_OPTIONS}
            value={connectedWithRecruiters || null}
            onChange={setConnectedWithRecruiters}
            columns={2}
          />
          <MissingNote show={showMissing && connectedWithRecruiters === ''} />
        </div>
      </div>

      <MissingSummary show={showMissing} missing={missing} />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
    </form>
  )
}
