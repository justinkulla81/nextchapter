'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { submitPostHireFeedbackAction, type CandidateActionState } from '@/app/hiring/(app)/candidates/[submissionId]/actions'

const RATINGS = [1, 2, 3, 4, 5]

// §A8 — "90-day post-hire feedback." A simple form: how's this hire
// working out. The yes/no question follows design-principles.md's 2-4
// discrete-options-as-buttons rule directly. The 1-5 rating is a
// deliberate, flagged exception to the "5+ options -> dropdown" rule: a
// 1-5 rating is a Likert-style scale, not an option list, and rendering it
// as a dropdown would be worse UX than the button row every rating control
// in this codebase already uses (see the identical pattern in
// ScorecardSubmitForm).
export function PostHireFeedbackForm({ submissionId }: { submissionId: string }) {
  const action = submitPostHireFeedbackAction.bind(null, submissionId)
  const [state, formAction, pending] = useActionState<CandidateActionState, FormData>(action, undefined)

  return (
    <form action={formAction} className={pending ? 'cursor-progress space-y-4 [&_*]:cursor-progress' : 'space-y-4'}>
      <div className="space-y-1.5">
        <Label>How is this hire working out? (1 = not well, 5 = excellent)</Label>
        <div className="flex gap-1.5">
          {RATINGS.map((r) => (
            <label
              key={r}
              className="flex size-9 cursor-pointer items-center justify-center rounded-md border border-input text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground"
            >
              <input type="radio" name="howIsItGoingRating" value={r} required className="sr-only" />
              {r}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Would you hire this person again?</Label>
        <div className="flex gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground">
            <input type="radio" name="wouldHireAgain" value="yes" required className="sr-only" />
            Yes
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground">
            <input type="radio" name="wouldHireAgain" value="no" required className="sr-only" />
            No
          </label>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="post-hire-notes">Notes (optional)</Label>
        <Textarea id="post-hire-notes" name="notes" rows={3} />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Submitting…' : 'Submit feedback'}
        </Button>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
    </form>
  )
}
