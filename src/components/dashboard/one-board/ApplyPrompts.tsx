'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import type { PromptAnswer } from '@/lib/jobs/my-jobs'
import { answerApplyPrompt } from '@/app/dashboard/find-my-job/my-jobs-actions'

export interface ApplyPromptView {
  trackedJobId: string
  title: string
  companyName: string | null
  clickedOn: string
}

const ANSWERS: { key: PromptAnswer; label: string }[] = [
  { key: 'applied', label: 'Applied' },
  { key: 'not_yet', label: 'Not yet' },
  { key: 'not_interested', label: 'Not interested' },
]

/** "You opened the application for X on <date> — did you apply?" Asked 2+ days after a click with no confirmation email. */
export function ApplyPrompts({ prompts }: { prompts: ApplyPromptView[] }) {
  const [answered, setAnswered] = useState<Record<string, PromptAnswer>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const open = prompts.filter((p) => !answered[p.trackedJobId])
  if (open.length === 0) return null

  function answer(id: string, a: PromptAnswer) {
    setBusy(id)
    setError(null)
    startTransition(async () => {
      const r = await answerApplyPrompt(id, a)
      setBusy(null)
      if (r.ok) setAnswered((x) => ({ ...x, [id]: a }))
      else setError(r.error)
    })
  }

  return (
    <div className="space-y-2" aria-live="polite">
      {open.map((p) => (
        <div key={p.trackedJobId} className={cn('flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2', busy === p.trackedJobId && 'cursor-wait')}>
          <p className="text-sm text-foreground">
            You opened the application for <span className="font-medium">{p.title}</span>
            {p.companyName && <> at {p.companyName}</>} on {p.clickedOn}. Did you apply?
          </p>
          <div role="group" aria-label={`Did you apply to ${p.title}?`} className="flex gap-1">
            {ANSWERS.map((a) => (
              <button
                key={a.key}
                type="button"
                disabled={busy === p.trackedJobId}
                aria-busy={busy === p.trackedJobId}
                onClick={() => answer(p.trackedJobId, a.key)}
                className={cn(
                  'rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted',
                  busy === p.trackedJobId && 'cursor-wait'
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
