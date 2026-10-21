'use client'

import { useActionState, useState } from 'react'
import { submitWorkInterests } from '@/app/dashboard/work-interests/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { cn } from '@/lib/utils'
import { INTEREST_ANSWER_LABELS, type InterestQuestion } from '@/lib/work-interests/areas'

const ANSWER_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: INTEREST_ANSWER_LABELS[n] }))

export function WorkInterestsForm({
  questions,
  initialAnswers,
}: {
  questions: InterestQuestion[]
  initialAnswers: Record<number, number>
}) {
  const [state, formAction, pending] = useActionState(submitWorkInterests, undefined)
  const [answers, setAnswers] = useState<Record<number, string | null>>(() =>
    Object.fromEntries(questions.map((q) => [q.index, initialAnswers[q.index] ? String(initialAnswers[q.index]) : null]))
  )
  const answered = Object.values(answers).filter(Boolean).length

  return (
    <form action={formAction} className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {answered} of {questions.length} answered
      </p>

      {questions.map((q) => (
        <div key={q.index} className="space-y-2">
          <Label>
            {q.index}. {q.text}
          </Label>
          <ChoiceButtons
            name={`answer__${q.index}`}
            options={ANSWER_OPTIONS}
            value={answers[q.index]}
            onChange={(value) => setAnswers((prev) => ({ ...prev, [q.index]: value }))}
            columns={5}
            responsive
            compact
          />
        </div>
      ))}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Scoring…">Save Work Interests</SubmitButton>
    </form>
  )
}
