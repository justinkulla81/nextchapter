'use client'

import { useActionState } from 'react'
import { submitInterviewResponse } from '@/app/dashboard/interview/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { PracticeEvaluation } from '@/lib/interview-prep/evaluate-practice-answer'

export function InterviewQuestionForm({
  questionId,
  questionText,
  initialResponse,
  feedback,
}: {
  questionId: string
  questionText: string
  initialResponse: string | null
  feedback: PracticeEvaluation | null
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
      <Textarea
        name="responseText"
        rows={4}
        defaultValue={initialResponse ?? ''}
        placeholder="Take your time — a few sentences is plenty."
      />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      {feedback && (
        <div className="space-y-2 rounded-lg border border-border bg-off-white p-3 text-sm">
          <p>
            <strong>Structure:</strong>{' '}
            {feedback.usesStarStructure
              ? 'Clear situation/task, action, result.'
              : "Doesn't clearly show a situation/task, action, and result yet."}
          </p>
          <p>
            <strong>Length:</strong> {feedback.lengthNote}
          </p>
          {feedback.strengths.length > 0 && (
            <div>
              <strong>What&apos;s working:</strong>
              <ul className="list-disc pl-5">
                {feedback.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {feedback.improvements.length > 0 && (
            <div>
              <strong>To sharpen:</strong>
              <ul className="list-disc pl-5">
                {feedback.improvements.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Saving…' : feedback ? 'Redraft' : 'Submit answer'}
      </Button>
    </form>
  )
}
