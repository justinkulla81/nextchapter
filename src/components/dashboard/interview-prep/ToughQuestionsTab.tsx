'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { requestToughAnswer, requestToughAnswerFeedback } from '@/app/dashboard/interview-prep/actions'
import { TOUGH_QUESTIONS } from '@/lib/interview-prep/constants'
import type { PracticeEvaluation } from '@/lib/interview-prep/evaluate-practice-answer'

export function ToughQuestionsTab({ hasJobDescription }: { hasJobDescription: boolean }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<Record<string, PracticeEvaluation>>({})
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleGenerate = (id: string, question: string) => {
    setPendingId(id)
    startTransition(async () => {
      const answer = await requestToughAnswer(question)
      const answerText = answer ?? 'Something went wrong — try again.'
      setAnswers((prev) => ({ ...prev, [id]: answerText }))
      if (answer) {
        const evaluation = await requestToughAnswerFeedback(question, answer)
        if (evaluation) setFeedback((prev) => ({ ...prev, [id]: evaluation }))
      }
      setPendingId(null)
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Objection questions name a real concern head-on. Trap questions are phrased to invite an
        answer that backfires if you&apos;re not ready for them. Generate a grounded answer for
        each, then see Victoria&apos;s take on it.
      </p>
      {TOUGH_QUESTIONS.map((q) => (
        <Card key={q.id} className={cn(pendingId === q.id && 'cursor-wait [&_*]:cursor-wait')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <span
                className={
                  q.category === 'objection'
                    ? 'rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand'
                    : 'rounded-full bg-orange/10 px-2 py-0.5 text-xs font-medium text-orange'
                }
              >
                {q.category === 'objection' ? 'Objection' : 'Trap'}
              </span>
              {q.question}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {answers[q.id] ? (
              <p className="text-sm text-foreground">{answers[q.id]}</p>
            ) : (
              <div className="space-y-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleGenerate(q.id, q.question)}
                  disabled={pendingId === q.id || !hasJobDescription}
                >
                  {pendingId === q.id ? 'Drafting…' : 'Draft my answer'}
                </Button>
                {!hasJobDescription && (
                  <p className="text-xs text-muted-foreground">Add the job description above first.</p>
                )}
              </div>
            )}

            {feedback[q.id] && (
              <div className="space-y-2 rounded-lg border border-border bg-off-white p-3 text-sm">
                <p>
                  <strong>Structure:</strong>{' '}
                  {feedback[q.id].usesStarStructure
                    ? 'Clear situation/task, action, result.'
                    : "Doesn't clearly show a situation/task, action, and result yet."}
                </p>
                <p>
                  <strong>Length:</strong> {feedback[q.id].lengthNote}
                </p>
                {feedback[q.id].strengths.length > 0 && (
                  <div>
                    <strong>What&apos;s working:</strong>
                    <ul className="list-disc pl-5">
                      {feedback[q.id].strengths.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {feedback[q.id].improvements.length > 0 && (
                  <div>
                    <strong>To sharpen:</strong>
                    <ul className="list-disc pl-5">
                      {feedback[q.id].improvements.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {answers[q.id] && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleGenerate(q.id, q.question)}
                disabled={pendingId === q.id}
              >
                {pendingId === q.id ? 'Redrafting…' : 'Redraft'}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
