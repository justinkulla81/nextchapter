'use client'

import { useActionState, useState } from 'react'
import { submitCrucibleContestEntry } from '@/app/crucible/employers/contests/entry/[token]/actions'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'

export function ContestEntryForm({ token, existingSubmission }: { token: string; existingSubmission: string | null }) {
  const boundAction = submitCrucibleContestEntry.bind(null, token)
  const [state, formAction] = useActionState(boundAction, undefined)
  // Controlled, not defaultValue — React's form-action reset behavior would
  // otherwise blank this out right after a successful submit, which reads
  // as "did that just get thrown away?" even though it saved.
  const [submission, setSubmission] = useState(existingSubmission ?? '')

  return (
    <form action={formAction} className="mt-6 space-y-3">
      <Textarea
        name="submission"
        required
        rows={10}
        value={submission}
        onChange={(e) => setSubmission(e.target.value)}
        placeholder="Write your idea or response here..."
      />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">Submitted — you can come back and update it anytime while this contest is open.</p>}
      <SubmitButton>{existingSubmission || state?.success ? 'Update submission' : 'Submit'}</SubmitButton>
    </form>
  )
}
