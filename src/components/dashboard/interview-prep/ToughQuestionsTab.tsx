'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { requestToughAnswer } from '@/app/dashboard/interview-prep/actions'
import { TOUGH_QUESTIONS } from '@/lib/interview-prep/constants'

const COMFORT_STOPS = [
  { value: 1, label: 'Rough' },
  { value: 2, label: 'Getting there' },
  { value: 3, label: 'Solid' },
  { value: 4, label: 'Nailed it' },
] as const

export function ToughQuestionsTab() {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [comfort, setComfort] = useState<Record<string, number>>({})
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleGenerate = (id: string, question: string) => {
    setPendingId(id)
    startTransition(async () => {
      const answer = await requestToughAnswer(question)
      setAnswers((prev) => ({ ...prev, [id]: answer ?? 'Something went wrong — try again.' }))
      setPendingId(null)
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Objection questions name a real concern head-on. Trap questions are phrased to invite an
        answer that backfires if you&apos;re not ready for them. Generate a grounded answer for
        each, then rate how comfortable you feel with it.
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
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleGenerate(q.id, q.question)}
                disabled={pendingId === q.id}
              >
                {pendingId === q.id ? 'Drafting…' : 'Draft my answer'}
              </Button>
            )}

            {answers[q.id] && (
              <div className="flex flex-wrap gap-1.5">
                {COMFORT_STOPS.map((stop) => (
                  <button
                    key={stop.value}
                    type="button"
                    onClick={() => setComfort((prev) => ({ ...prev, [q.id]: stop.value }))}
                    className={
                      comfort[q.id] === stop.value
                        ? 'rounded-md border-2 border-brand bg-brand/5 px-2 py-1 text-xs font-medium text-brand'
                        : 'rounded-md border-2 border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:border-brand/40'
                    }
                  >
                    {stop.label}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
