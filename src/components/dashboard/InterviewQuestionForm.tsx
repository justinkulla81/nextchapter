'use client'

import { useActionState } from 'react'
import { submitInterviewResponse } from '@/app/dashboard/interview/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export function InterviewQuestionForm({
  questionId,
  questionText,
}: {
  questionId: string
  questionText: string
}) {
  const [state, formAction, pending] = useActionState(submitInterviewResponse, undefined)

  return (
    <form
      action={formAction}
      className={cn(
        'space-y-3 rounded-lg border border-border p-4',
        pending && 'cursor-progress [&_*]:cursor-progress'
      )}
    >
      <input type="hidden" name="questionId" value={questionId} />
      <input type="hidden" name="questionText" value={questionText} />
      <p className="font-medium">{questionText}</p>
      <Textarea name="responseText" rows={4} placeholder="Take your time — a few sentences is plenty." />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Saving…' : 'Submit answer'}
      </Button>
    </form>
  )
}
