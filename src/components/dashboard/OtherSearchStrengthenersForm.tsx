'use client'

import { useActionState, useState } from 'react'
import { updateOtherSearchStrengtheners } from '@/app/dashboard/search-strategy/actions'
import { useAdvanceSearchStrategyPageOnSave } from '@/components/dashboard/SearchStrategyWizard'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { cn } from '@/lib/utils'

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
  boardAdvisoryInitial,
  optionalQuestionsInitial,
}: {
  boardAdvisoryInitial: boolean | null
  optionalQuestionsInitial?: {
    networkingLevel: number | null
    learnedNewSkillsLevel: number | null
    triedPartTimeOrConsulting: boolean | null
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
  const [triedPartTimeOrConsulting, setTriedPartTimeOrConsulting] = useState(
    yesNoToString(optionalQuestionsInitial?.triedPartTimeOrConsulting ?? null)
  )
  const [triedExecutiveCoaching, setTriedExecutiveCoaching] = useState(
    yesNoToString(optionalQuestionsInitial?.triedExecutiveCoaching ?? null)
  )
  const [connectedWithRecruiters, setConnectedWithRecruiters] = useState(
    yesNoToString(optionalQuestionsInitial?.connectedWithRecruiters ?? null)
  )

  return (
    <form action={formAction} className={cn('space-y-8', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="space-y-4">
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
      </div>

      <div className="space-y-5 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">A Few More Details</h3>

        <div className="space-y-2">
          <Label>How much have you been networking?</Label>
          <ChoiceButtons
            name="networkingLevel"
            options={NETWORKING_LEVEL_OPTIONS}
            value={networkingLevel || null}
            onChange={setNetworkingLevel}
            columns={4}
          />
        </div>

        <div className="space-y-2">
          <Label>Have you used your time to learn new skills?</Label>
          <ChoiceButtons
            name="learnedNewSkillsLevel"
            options={LEARNED_NEW_SKILLS_OPTIONS}
            value={learnedNewSkillsLevel || null}
            onChange={setLearnedNewSkillsLevel}
            columns={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Have you done part-time/interim work or consulting?</Label>
          <ChoiceButtons
            name="triedPartTimeOrConsulting"
            options={YES_NO_OPTIONS}
            value={triedPartTimeOrConsulting || null}
            onChange={setTriedPartTimeOrConsulting}
            columns={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Have you tried Executive Coaching?</Label>
          <ChoiceButtons
            name="triedExecutiveCoaching"
            options={YES_NO_OPTIONS}
            value={triedExecutiveCoaching || null}
            onChange={setTriedExecutiveCoaching}
            columns={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Have you connected with recruiters?</Label>
          <ChoiceButtons
            name="connectedWithRecruiters"
            options={YES_NO_OPTIONS}
            value={connectedWithRecruiters || null}
            onChange={setConnectedWithRecruiters}
            columns={2}
          />
          {connectedWithRecruiters === 'yes' && (
            <Input
              name="recruiterConnectionCount"
              type="number"
              min={0}
              placeholder="How many?"
              defaultValue={optionalQuestionsInitial?.recruiterConnectionCount ?? undefined}
              className="max-w-32"
            />
          )}
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
    </form>
  )
}
