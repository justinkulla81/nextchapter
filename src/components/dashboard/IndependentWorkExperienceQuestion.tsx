'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import {
  INDEPENDENT_WORK_STATUS_OPTIONS,
  INDEPENDENT_WORK_TYPES,
  type IndependentWorkExperience,
  type IndependentWorkStatus,
  type IndependentWorkSuggestions,
  type IndependentWorkType,
} from '@/lib/independent-work/experience'

// One row per kind of independent work, three adjacent buttons each. A row we
// could read from email or logged work starts pre-selected with a plain note
// saying what we saw — the candidate confirms or changes it.
export function IndependentWorkExperienceQuestion({
  initial,
  suggestions,
}: {
  initial: IndependentWorkExperience
  suggestions: IndependentWorkSuggestions
}) {
  const [answers, setAnswers] = useState<Record<IndependentWorkType, IndependentWorkStatus | null>>(() => {
    const start = {} as Record<IndependentWorkType, IndependentWorkStatus | null>
    for (const { key } of INDEPENDENT_WORK_TYPES) {
      start[key] = initial[key] ?? suggestions[key]?.status ?? null
    }
    return start
  })
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
          <fieldset key={key} className="space-y-2">
            <legend className="text-sm font-medium text-foreground">{label}</legend>
            <ChoiceButtons
              name={`independentWork_${key}`}
              options={INDEPENDENT_WORK_STATUS_OPTIONS}
              value={answers[key]}
              onChange={(value) => {
                setAnswers((prev) => ({ ...prev, [key]: value }))
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
          </fieldset>
        )
      })}
    </div>
  )
}
