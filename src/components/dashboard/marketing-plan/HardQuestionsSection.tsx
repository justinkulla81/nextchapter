'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InlineLoadingState } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { generateHardQuestionsAction } from '@/app/dashboard/marketing-plan/actions'
import type { HardQuestionAnswers } from '@/lib/narrative/hard-questions'

const QUESTION_LABELS: Record<keyof HardQuestionAnswers, string> = {
  whatHappened: 'So what happened at your last job?',
  whyLooking: "Why are you looking for something new right now?",
  howsItGoing: "How's the job search going?",
  whatsNext: 'So what are you looking for next?',
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

// Deliberately distinct, casual visual framing from Interview Prep's
// formal Tough Questions — off-white background instead of a plain Card
// grid, and copy that says outright these aren't interview answers.
export function HardQuestionsSection({
  hardQuestions,
  routeToCoach,
}: {
  hardQuestions: HardQuestionAnswers | null
  routeToCoach: boolean
}) {
  const [isPending, startTransition] = useTransition()

  const handleGenerate = () => {
    startTransition(async () => {
      await generateHardQuestionsAction()
    })
  }

  if (routeToCoach) {
    return (
      <div className="rounded-lg border border-border bg-off-white p-4 text-sm text-foreground">
        This is worth raising directly with your coach rather than generating an answer here — they&apos;ll
        help you find the right words for it.
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', isPending && 'cursor-wait [&_*]:cursor-wait')}>
      <p className="text-sm text-muted-foreground">
        Not interview prep — this is the casual version. What do you actually say when a friend, an old
        colleague, or someone at a party asks you these? Short, honest, no corporate language.
      </p>
      {!hardQuestions ? (
        <div className="space-y-3">
          <Button type="button" onClick={handleGenerate} disabled={isPending} className={isPending ? 'cursor-wait' : ''}>
            {isPending ? 'Drafting…' : 'Get answers to the hard questions'}
          </Button>
          {isPending && <InlineLoadingState label="Drafting casual answers…" />}
        </div>
      ) : (
        <div className="space-y-3">
          {(Object.keys(QUESTION_LABELS) as (keyof HardQuestionAnswers)[]).map((key) => (
            <Card key={key} className="bg-off-white">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">{QUESTION_LABELS[key]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="whitespace-pre-line text-sm text-foreground">{hardQuestions[key]}</p>
                <CopyButton text={hardQuestions[key]} />
              </CardContent>
            </Card>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={isPending}
            className={isPending ? 'cursor-wait' : ''}
          >
            {isPending ? 'Regenerating…' : 'Regenerate'}
          </Button>
        </div>
      )}
    </div>
  )
}
