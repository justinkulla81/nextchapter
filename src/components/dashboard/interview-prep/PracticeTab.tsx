'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { SectionBlock } from '@/components/candidate/Blocks'
import { AnswerFeedback } from './AnswerFeedback'
import { requestPracticeEvaluation } from '@/app/dashboard/interview-prep/actions'
import { PRACTICE_QUESTION_TEMPLATES } from '@/lib/interview-prep/constants'
import type { PracticeEvaluation } from '@/lib/interview-prep/evaluate-practice-answer'

export function PracticeTab({
  targetRoleType,
  hasJobDescription,
  redesign = false,
}: {
  targetRoleType: string | null
  hasJobDescription: boolean
  redesign?: boolean
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

  if (redesign) {
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Type your answer to each question like you&apos;d say it out loud
        {targetRoleType ? ` for a ${targetRoleType} interview` : ''} — Victoria gives you honest
        feedback on structure, specificity, and length.
      </p>
      {PRACTICE_QUESTION_TEMPLATES.map((question, index) => {
        const evaluation = evaluations[index]
        return (
          <Card key={question} className={cn(pendingIndex === index && 'cursor-wait [&_*]:cursor-wait')}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">{question}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={answers[index] ?? ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [index]: e.target.value }))}
                placeholder="Type your answer here…"
                rows={4}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => handleEvaluate(index, question)}
                disabled={pendingIndex === index || !answers[index]?.trim() || !hasJobDescription}
              >
                {pendingIndex === index
                  ? 'Evaluating…'
                  : evaluation
                    ? 'Redraft — get new feedback'
                    : 'Get feedback'}
              </Button>
              {!hasJobDescription && (
                <p className="text-xs text-muted-foreground">Add the job description above first.</p>
              )}

              {evaluation && (
                <div className="space-y-2 rounded-lg border border-border bg-off-white p-3 text-sm">
                  <p>
                    <strong>Structure:</strong>{' '}
                    {evaluation.usesStarStructure
                      ? 'Clear situation/task, action, result.'
                      : "Doesn't clearly show a situation/task, action, and result yet."}
                  </p>
                  <p>
                    <strong>Length:</strong> {evaluation.lengthNote}
                  </p>
                  {evaluation.strengths.length > 0 && (
                    <div>
                      <strong>What&apos;s working:</strong>
                      <ul className="list-disc pl-5">
                        {evaluation.strengths.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {evaluation.improvements.length > 0 && (
                    <div>
                      <strong>To sharpen:</strong>
                      <ul className="list-disc pl-5">
                        {evaluation.improvements.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
