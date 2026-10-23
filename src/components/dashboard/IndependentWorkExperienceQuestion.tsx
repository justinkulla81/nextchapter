'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { MissingNote } from '@/components/dashboard/RequiredQuestions'
import {
  INDEPENDENT_WORK_STATUS_OPTIONS,
  INDEPENDENT_WORK_TYPES,
  type IndependentWorkExperience,
  type IndependentWorkStatus,
  type IndependentWorkSuggestions,
  type IndependentWorkType,
} from '@/lib/independent-work/experience'

// Starting answers: the candidate's saved answer, else what email or logged
// work suggested, else nothing. Lives here so the form that owns the answers
// (it needs them to say which questions are still open) starts from the same
// values this component shows.
export function initialIndependentWorkAnswers(
  initial: IndependentWorkExperience,
  suggestions: IndependentWorkSuggestions
): Record<IndependentWorkType, IndependentWorkStatus | null> {
  const start = {} as Record<IndependentWorkType, IndependentWorkStatus | null>
  for (const { key } of INDEPENDENT_WORK_TYPES) {
    start[key] = initial[key] ?? suggestions[key]?.status ?? null
  }
  return start
}

// One row per kind of independent work, three adjacent buttons each. A row we
// could read from email or logged work starts pre-selected with a plain note
// saying what we saw — the candidate confirms or changes it. The answers are
// owned by the parent form, which names any unanswered row when a save is
// blocked; `showMissing` turns on the per-row message.
export function IndependentWorkExperienceQuestion({
  answers,
  onChange,
  suggestions,
  showMissing,
}: {
  answers: Record<IndependentWorkType, IndependentWorkStatus | null>
  onChange: (type: IndependentWorkType, value: IndependentWorkStatus) => void
  suggestions: IndependentWorkSuggestions
  showMissing: boolean
}) {
  const [touched, setTouched] = useState<Set<IndependentWorkType>>(new Set())

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Are you already doing independent or part-time work, or have you before?</Label>
        <p className="text-sm text-muted-foreground">
          Answer each one. Where we spotted something in your email or work history, we filled it in for you to confirm.
        </p>
      </div>

      {INDEPENDENT_WORK_TYPES.map(({ key, label }) => {
        const suggestion = suggestions[key]
        const showNote = suggestion && !touched.has(key) && answers[key] === suggestion.status
        return (
          <fieldset key={key} id={`question-independent-${key}`} className="scroll-mt-24 space-y-2">
            <legend className="text-sm font-medium text-foreground">{label}</legend>
            <ChoiceButtons
              name={`independentWork_${key}`}
              options={INDEPENDENT_WORK_STATUS_OPTIONS}
              value={answers[key]}
              onChange={(value) => {
                onChange(key, value)
                setTouched((prev) => new Set(prev).add(key))
              }}
              columns={3}
              responsive
              compact
            />
            {suggestion && <input type="hidden" name="independentWork_prefilled" value={key} />}
            {showNote && (
              <p className="text-xs text-muted-foreground">
                We saw {suggestion.evidence.slice(0, 3).join(', ')}. Change this if it&apos;s not right.
              </p>
            )}
            <MissingNote show={showMissing && answers[key] === null} />
          </fieldset>
        )
      })}
    </div>
  )
}
