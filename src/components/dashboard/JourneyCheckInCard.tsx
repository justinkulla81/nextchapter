'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { CHECK_IN_ANSWERS } from '@/lib/journey/journey'
import { answerJourneyCheckIn } from '@/app/dashboard/journey-actions'

// "Has anything changed?" One question, one answer set, everywhere it's
// asked (Journeys tab of the product design doc). Shown at the pace of the
// member's stage: weekly while applying, monthly while exploring.
export function JourneyCheckInCard({ journeyLabel, stageLabel }: { journeyLabel: string; stageLabel: string }) {
  const posthog = usePostHog()
  const [answer, setAnswer] = useState('nothing')
  const [pending, start] = useTransition()
  const [done, setDone] = useState<{ next?: { href: string; label: string } } | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (done) {
    return (
      <div role="status" className="rounded-lg border border-border bg-card p-4 text-sm">
        <p className="font-medium">Thanks, got it.</p>
        {done.next && (
          <Link href={done.next.href} className="mt-1 inline-block font-medium text-primary hover:underline">
            {done.next.label}
          </Link>
        )}
      </div>
    )
  }

  return (
    <form
      className={cn('flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4', pending && 'cursor-wait')}
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          const r = await answerJourneyCheckIn(answer)
          if (r.error) return setError(r.error)
          posthog?.capture('journey_check_in_answered', { answer })
          setDone(r)
        })
      }}
    >
      <div className="min-w-64 flex-1 space-y-1.5">
        <Label htmlFor="journey-check-in" className="text-sm font-semibold">
          Has anything changed?
        </Label>
        <p className="text-xs text-muted-foreground">
          You&apos;re set to {journeyLabel.toLowerCase()}, {stageLabel.toLowerCase()}. Your plan follows your answer.
        </p>
        <select
          id="journey-check-in"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {CHECK_IN_ANSWERS.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending} className={cn(pending && 'cursor-wait')}>
        {pending ? 'Saving…' : 'Save answer'}
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
