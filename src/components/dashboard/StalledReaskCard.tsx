'use client'

import { useEffect, useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { answerReask, recordReaskShown, snoozeReask, stopReask } from '@/app/dashboard/reask-actions'
import { posthog } from '@/lib/posthog/client'
import type { ReaskOption } from '@/lib/journey/stalled-reask'

// The one Home note when a search has run a while with no interviews: what do you want to change? Four answers, each with why
// (one reason, one place to go). Counts as asked only once it paints.
export function StalledReaskCard({ weeks, options }: { weeks: number; options: ReaskOption[] }) {
  const [hidden, setHidden] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(() => {
      recordReaskShown(weeks)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (hidden) return null

  return (
    <Card className={cn('border-brand/30 bg-brand/5', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">{weeks} weeks in, no interviews yet. What do you want to change?</p>
          <p className="text-sm text-muted-foreground">
            Why we ask: a search that goes quiet usually needs one change, not more of the same. Pick one and your plan follows it for four weeks.
          </p>
        </div>
        <ul className="space-y-3">
          {options.map((o) => (
            <li key={o.key} className="space-y-1 rounded-lg border border-border bg-background p-3">
              <form action={answerReask} onSubmit={() => posthog.capture('stalled_reask_option_pressed', { answer: o.key, weeks })}>
                <input type="hidden" name="choice" value={o.key} />
                <input type="hidden" name="weeks" value={weeks} />
                <p className="text-sm font-semibold text-foreground">{o.label}</p>
                <p className="text-sm text-muted-foreground">{o.body}</p>
                <p className="mb-2 text-sm text-muted-foreground">Why: {o.because}</p>
                <Button type="submit" size="sm" disabled={pending}>
                  Choose this
                </Button>
              </form>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setHidden(true)
              startTransition(() => {
                snoozeReask(weeks)
              })
            }}
          >
            Not now
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setHidden(true)
              startTransition(() => {
                stopReask(weeks)
              })
            }}
          >
            Don&apos;t ask again
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
