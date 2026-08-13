'use client'

import { useActionState, useState } from 'react'
import { answerOptionalQuestions, type OptionalQuestionsState } from '@/app/dashboard/complete-profile/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { cn } from '@/lib/utils'

const JOBS_APPLIED_OPTIONS = [
  { value: '0-20', label: '0–20' },
  { value: '20-100', label: '20–100' },
  { value: '100+', label: '100+' },
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

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

function yesNoToString(value: boolean | null) {
  return value === true ? 'yes' : value === false ? 'no' : ''
}

export function OptionalQuestionsForm({
  initial,
}: {
  initial?: {
    jobsAppliedBucket: string | null
    interviewsReceivedCount: number | null
    networkingLevel: number | null
    learnedNewSkillsLevel: number | null
    triedPartTimeOrConsulting: boolean | null
    triedExecutiveCoaching: boolean | null
    connectedWithRecruiters: boolean | null
    recruiterConnectionCount: number | null
  }
}) {
  const [state, formAction, pending] = useActionState<OptionalQuestionsState, FormData>(
    answerOptionalQuestions,
    undefined
  )
  const [jobsAppliedBucket, setJobsAppliedBucket] = useState(initial?.jobsAppliedBucket ?? '')
  const [networkingLevel, setNetworkingLevel] = useState(initial?.networkingLevel?.toString() ?? '')
  const [learnedNewSkillsLevel, setLearnedNewSkillsLevel] = useState(initial?.learnedNewSkillsLevel?.toString() ?? '')
  const [triedPartTimeOrConsulting, setTriedPartTimeOrConsulting] = useState(
    yesNoToString(initial?.triedPartTimeOrConsulting ?? null)
  )
  const [triedExecutiveCoaching, setTriedExecutiveCoaching] = useState(
    yesNoToString(initial?.triedExecutiveCoaching ?? null)
  )
  const [connectedWithRecruiters, setConnectedWithRecruiters] = useState(
    yesNoToString(initial?.connectedWithRecruiters ?? null)
  )

  return (
    <form action={formAction} className={cn('space-y-5', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="space-y-2">
        <Label>How many jobs have you applied for?</Label>
        <ChoiceButtons
          name="jobsAppliedBucket"
          options={JOBS_APPLIED_OPTIONS}
          value={jobsAppliedBucket || null}
          onChange={setJobsAppliedBucket}
          columns={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="interviewsReceivedCount">How many interviews have you received?</Label>
        <Input
          id="interviewsReceivedCount"
          name="interviewsReceivedCount"
          type="number"
          min={0}
          defaultValue={initial?.interviewsReceivedCount ?? undefined}
          className="max-w-32"
        />
      </div>

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
            defaultValue={initial?.recruiterConnectionCount ?? undefined}
            className="max-w-32"
          />
        )}
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save answers'}
      </Button>
    </form>
  )
}
