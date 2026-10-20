'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { SectionBlock } from '@/components/candidate/Blocks'
import { AnswerFeedback } from './AnswerFeedback'
import { requestPracticeEvaluation } from '@/app/dashboard/interview-prep/actions'
import { PRACTICE_QUESTION_TEMPLATES } from '@/lib/interview-prep/constants'
import type { PracticeEvaluation } from '@/lib/interview-prep/evaluate-practice-answer'

export function PracticeTab({
  targetRoleType,
  hasJobDescription,
}: {
  targetRoleType: string | null
  hasJobDescription: boolean
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [evaluations, setEvaluations] = useState<Record<number, PracticeEvaluation>>({})
  const [pendingIndex, setPendingIndex] = useState<number | null>(null)
  const [, startTransition] = useTransition()

  const handleEvaluate = (index: number, question: string) => {
    const answerText = answers[index]?.trim()
    if (!answerText) return

    setPendingIndex(index)
    startTransition(async () => {
      const evaluation = await requestPracticeEvaluation(question, answerText)
      if (evaluation) setEvaluations((prev) => ({ ...prev, [index]: evaluation }))
      setPendingIndex(null)
    })
  }

  return (
    <div className="space-y-6">
      <SectionBlock
        id="practice-h"
        title="Practice out loud, in writing"
        why={`Type each answer the way you would say it${targetRoleType ? ` in a ${targetRoleType} interview` : ''}. Victoria tells you how it comes across on structure, specifics and length.`}
      />
      <ul className="divide-y divide-border">
        {PRACTICE_QUESTION_TEMPLATES.map((question, index) => {
          const evaluation = evaluations[index]
          const busy = pendingIndex === index
          const noAnswer = !answers[index]?.trim()
          return (
            <li key={question} className={cn('space-y-3 py-5 first:pt-0', busy && 'cursor-wait [&_*]:cursor-wait')}>
              <h3 className="font-display text-lg font-semibold text-ink">{question}</h3>
              <Textarea
                value={answers[index] ?? ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [index]: e.target.value }))}
                placeholder="Type your answer here"
                aria-label={`Your answer to: ${question}`}
                rows={4}
                className="max-w-2xl text-base"
              />
              <div className="space-y-2">
                <Button type="button" variant="outline" onClick={() => handleEvaluate(index, question)} disabled={busy || noAnswer || !hasJobDescription}>
                  {busy ? 'Reading your answer' : evaluation ? 'Get new feedback' : 'Get feedback'}
                </Button>
                {!hasJobDescription ? (
                  <p className="text-base text-muted-foreground">Add the job description above first, so the feedback is about this job.</p>
                ) : noAnswer ? (
                  <p className="text-base text-muted-foreground">Type an answer to get feedback on it.</p>
                ) : null}
              </div>
              {evaluation && <AnswerFeedback evaluation={evaluation} />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
