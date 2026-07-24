'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { updateResumeCommentary, type CommentaryFormState } from '@/app/recruiters/candidates/actions'

export function ResumeCommentaryForm({
  sourcedCandidateId,
  initialValue,
}: {
  sourcedCandidateId: string
  initialValue: string | null
}) {
  const action = updateResumeCommentary.bind(null, sourcedCandidateId)
  const [state, formAction, pending] = useActionState<CommentaryFormState, FormData>(action, undefined)

  return (
    <form action={formAction} className={pending ? 'cursor-progress space-y-3 [&_*]:cursor-progress' : 'space-y-3'}>
      <Textarea
        name="resumeCommentary"
        defaultValue={initialValue ?? ''}
        placeholder="Your take on their resume — strengths, fit for a role, anything worth flagging to an employer."
        rows={5}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save commentary'}
        </Button>
        {state?.saved && <p className="text-sm text-brand">Saved.</p>}
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
    </form>
  )
}
