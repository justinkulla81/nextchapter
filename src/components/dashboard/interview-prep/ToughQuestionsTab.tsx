'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SectionBlock } from '@/components/candidate/Blocks'
import { AnswerFeedback } from './AnswerFeedback'
import { requestToughAnswer, requestToughAnswerFeedback } from '@/app/dashboard/interview-prep/actions'
import { TOUGH_QUESTIONS } from '@/lib/interview-prep/constants'
import type { PracticeEvaluation } from '@/lib/interview-prep/evaluate-practice-answer'

export function ToughQuestionsTab({
  hasJobDescription,
  jobHoppingFlag,
}: {
  hasJobDescription: boolean
  jobHoppingFlag: boolean
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<Record<string, PracticeEvaluation>>({})
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // A confirmed short-tenure pattern makes the jobhop question the one most
  // likely to actually come up — surface it first instead of leaving it at
  // its generic list position.
  const orderedQuestions = jobHoppingFlag
    ? [...TOUGH_QUESTIONS].sort((a, b) => (a.id === 'jobhop' ? -1 : b.id === 'jobhop' ? 1 : 0))
    : TOUGH_QUESTIONS

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
    <div className="space-y-6">
      <SectionBlock
        id="tough-h"
        title="Tough questions"
        why="Some name a real concern head-on and some are phrased to trap you. Draft a grounded answer for each, then see Victoria's take on it."
      />
      <ul className="divide-y divide-border">
        {orderedQuestions.map((q) => {
          const busy = pendingId === q.id
          return (
            <li key={q.id} className={cn('space-y-3 py-5 first:pt-0', busy && 'cursor-wait [&_*]:cursor-wait')}>
              <h3 className="font-display text-lg font-semibold text-ink">{q.question}</h3>
              <p className="max-w-2xl text-base text-muted-foreground">
                {jobHoppingFlag && q.id === 'jobhop'
                  ? 'Likely to come up, because your work history shows several short stays.'
                  : q.category === 'objection'
                    ? 'It names a real concern head-on.'
                    : 'It is phrased to invite an answer that backfires.'}
              </p>
              {answers[q.id] ? (
                <p className="max-w-2xl text-base text-ink">{answers[q.id]}</p>
              ) : null}
              {feedback[q.id] && <AnswerFeedback evaluation={feedback[q.id]} />}
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleGenerate(q.id, q.question)}
                  disabled={busy || !hasJobDescription}
                >
                  {busy ? (answers[q.id] ? 'Redrafting your answer' : 'Drafting your answer') : answers[q.id] ? 'Redraft' : 'Draft my answer'}
                </Button>
                {!hasJobDescription && <p className="text-base text-muted-foreground">Add the job description above first, so the answer is about this job.</p>}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
