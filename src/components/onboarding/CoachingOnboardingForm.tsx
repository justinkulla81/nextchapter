'use client'

import { useState, useTransition } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import type { CoachingOnboardingAnswerValue, CoachingOnboardingAnswers, EffectiveTemplateQuestion } from '@/lib/coach/onboarding-form-shared'
import { cn } from '@/lib/utils'

function groupBySection(template: EffectiveTemplateQuestion[]) {
  const sections: { section: string; questions: EffectiveTemplateQuestion[] }[] = []
  for (const q of template) {
    let group = sections.find((s) => s.section === q.section)
    if (!group) {
      group = { section: q.section, questions: [] }
      sections.push(group)
    }
    group.questions.push(q)
  }
  return sections
}

// Prompt 60's candidate-facing "Coaching Onboarding Form" — shared between
// the onboarding-time entry point (new candidates who came in through a
// coach invite link) and the dashboard entry point (existing candidates who
// grant consent later from Privacy settings). Self-serve, goal-setting and
// working-relationship material ONLY — this is not, and must never become,
// a place for sensitive topics; that stays a live conversation with the coach.
export function CoachingOnboardingForm({
  template,
  onSubmit,
  submitLabel,
}: {
  template: EffectiveTemplateQuestion[]
  onSubmit: (answers: CoachingOnboardingAnswers) => Promise<{ error?: string } | void>
  submitLabel: string
}) {
  const [answers, setAnswers] = useState<CoachingOnboardingAnswers>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function setAnswer(id: string, value: CoachingOnboardingAnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await onSubmit(answers)
      if (result?.error) setError(result.error)
    })
  }

  const sections = groupBySection(template)

  return (
    <div className={cn('space-y-8', pending && 'cursor-progress [&_*]:cursor-progress')}>
      {sections.map((group) => (
        <div key={group.section} className="space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group.section}</h2>
          {group.questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <Label htmlFor={q.id}>
                {q.label}
                {q.optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
              </Label>

              {q.type === 'short_text' && (
                <Input id={q.id} value={(answers[q.id] as string) ?? ''} onChange={(e) => setAnswer(q.id, e.target.value)} />
              )}

              {q.type === 'long_text' && (
                <Textarea
                  id={q.id}
                  rows={3}
                  value={(answers[q.id] as string) ?? ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                />
              )}

              {q.type === 'date' && (
                <Input
                  id={q.id}
                  type="date"
                  value={(answers[q.id] as string) ?? ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                />
              )}

              {q.type === 'multiple_choice' &&
                (q.options && q.options.length <= 4 ? (
                  <ChoiceButtons
                    name={q.id}
                    options={(q.options ?? []).map((o) => ({ value: o, label: o }))}
                    value={(answers[q.id] as string) ?? null}
                    onChange={(v) => setAnswer(q.id, v)}
                  />
                ) : (
                  <select
                    id={q.id}
                    value={(answers[q.id] as string) ?? ''}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className="h-11 w-full rounded-lg border border-input bg-transparent px-4 text-sm"
                  >
                    <option value="" disabled>
                      Select one
                    </option>
                    {(q.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ))}

              {q.type === 'scale' && (
                <ChoiceButtons
                  name={q.id}
                  options={Array.from({ length: q.scaleMax ?? 5 }, (_, i) => ({
                    value: String(i + 1),
                    label: String(i + 1),
                  }))}
                  value={answers[q.id] !== undefined ? String(answers[q.id]) : null}
                  onChange={(v) => setAnswer(q.id, Number(v))}
                />
              )}
            </div>
          ))}
        </div>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="button" disabled={pending} onClick={submit}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </div>
  )
}
