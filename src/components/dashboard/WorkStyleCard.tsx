'use client'

import { useState, useTransition } from 'react'
import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { saveWorkStyleAnswer } from '@/app/dashboard/work-profile/actions'
import { WORK_DIMS, type WorkDim } from '@/lib/profile/work-profile'

// "This or that": one quick pick per dimension (three buttons: a pole,
// either, the other pole). `dims` = the ones to ask; `current` = the value
// we have for each (-1..+1), shown as the pressed button.
export function WorkStyleCard({ dims, current, title, intro }: { dims: WorkDim[]; current: Partial<Record<WorkDim, number>>; title: string; intro: string }) {
  const [values, setValues] = useState(current)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  if (!dims.length) return null
  const answered = dims.filter((d) => values[d] !== undefined).length
  return (
    <section aria-labelledby="ws-h" className={cn('space-y-3 rounded-lg border border-border bg-card p-4', pending && 'cursor-wait')}>
      <div>
        <h2 id="ws-h" className="text-base font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{intro}</p>
      </div>
      <ul className="space-y-3">
        {dims.map((key) => {
          const d = WORK_DIMS.find((x) => x.key === key)!
          const v = values[key]
          const picked = v === undefined ? null : v <= -0.4 ? -2 : v >= 0.4 ? 2 : 0
          const opts: { value: -2 | 0 | 2; label: string }[] = [
            { value: -2, label: d.low },
            { value: 0, label: 'Either' },
            { value: 2, label: d.high },
          ]
          return (
            <li key={key} className="space-y-1.5">
              <p className="text-sm font-medium">{d.question}</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label={d.question}>
                {opts.map((o) => (
                  <Button
                    key={o.value}
                    type="button"
                    size="sm"
                    variant={picked === o.value ? 'default' : 'outline'}
                    aria-pressed={picked === o.value}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await saveWorkStyleAnswer(key, o.value)
                        if (r.error) setError(r.error)
                        else {
                          setError(null)
                          setValues({ ...values, [key]: o.value / 2 })
                          posthog.capture('work_style_card_answered', { dimension: key, value: o.value })
                        }
                      })
                    }
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        {answered} of {dims.length} answered. We use these to rank jobs and pivot paths by how you like to work. Change any answer any time.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
