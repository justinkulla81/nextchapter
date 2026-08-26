'use client'

import { useActionState } from 'react'
import type { HiringCompetencyKey } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { COMPETENCY_KEYS, COMPETENCY_KEY_LABEL } from '@/lib/talent/scorecard-constants'
import { submitScorecardAction, type ScorecardFormState } from '@/app/scorecard/[token]/actions'

const RECOMMENDATIONS: { value: string; label: string }[] = [
  { value: 'STRONG_YES', label: 'Strong yes' },
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
  { value: 'STRONG_NO', label: 'Strong no' },
]

// Ported from src/components/hiring/ScorecardSubmitForm.tsx (and relocated
// alongside its route, src/app/scorecard/[token]) as part of the /hiring ->
// /talent consolidation.
//
// Per-competency 1-5 scores render as button rows, same deliberate
// exception to design-principles.md's "5+ options -> dropdown" rule as
// PostHireFeedbackForm — a rating scale isn't an option list, and
// RatingScale.tsx already establishes button-row-for-a-1-5-rating as this
// codebase's convention.
export function ScorecardSubmitForm({ token, assignedCompetency }: { token: string; assignedCompetency: HiringCompetencyKey | null }) {
  const action = submitScorecardAction.bind(null, token)
  const [state, formAction, pending] = useActionState<ScorecardFormState, FormData>(action, undefined)

  if (state?.success) {
    return <p className="text-sm text-muted-foreground">Thanks — your scorecard has been submitted.</p>
  }

  return (
    <form action={formAction} className={pending ? 'cursor-progress space-y-6 [&_*]:cursor-progress' : 'space-y-6'}>
      {assignedCompetency && (
        <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
          You&apos;re assigned to probe <span className="font-medium text-foreground">{COMPETENCY_KEY_LABEL[assignedCompetency]}</span>{' '}
          — score the others too if you have relevant evidence.
        </p>
      )}
      {COMPETENCY_KEYS.map((key) => (
        <div key={key} className="space-y-2 rounded-lg border border-border p-4">
          <p className={`text-sm font-medium ${assignedCompetency === key ? 'text-foreground' : 'text-muted-foreground'}`}>
            {COMPETENCY_KEY_LABEL[key]}
            {assignedCompetency === key && <span className="ml-1.5 text-xs text-brand">(your assignment)</span>}
          </p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((score) => (
              <label
                key={score}
                className="flex size-9 cursor-pointer items-center justify-center rounded-md border border-input text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground"
              >
                <input type="radio" name={`score-${key}`} value={score} className="sr-only" />
                {score}
              </label>
            ))}
          </div>
          <Textarea name={`notes-${key}`} rows={2} placeholder="Notes (optional)" />
        </div>
      ))}
      <div className="space-y-1.5">
        <Label>Overall recommendation</Label>
        <div className="flex flex-wrap gap-2">
          {RECOMMENDATIONS.map((r) => (
            <label
              key={r.value}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground"
            >
              <input type="radio" name="overallRecommendation" value={r.value} className="sr-only" />
              {r.label}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="overallNotes">Overall notes (optional)</Label>
        <Textarea id="overallNotes" name="overallNotes" rows={3} />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Submitting…' : 'Submit scorecard'}
        </Button>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
    </form>
  )
}
