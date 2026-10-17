'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import type { PromptAnswer } from '@/lib/jobs/my-jobs'
import { answerApplyPrompts } from '@/app/dashboard/find-my-job/my-jobs-actions'

export interface ApplyPromptView {
  trackedJobId: string
  title: string
  companyName: string | null
  clickedOn: string
}

const ANSWERS: { key: PromptAnswer; label: string }[] = [
  { key: 'applied', label: 'Yes' },
  { key: 'not_yet', label: 'Not yet' },
  { key: 'not_interested', label: 'Not interested' },
]

const buttonClass = 'rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted'

function jobName(p: ApplyPromptView) {
  return (
    <>
      <span className="font-medium">{p.title}</span>
      {p.companyName && <> at {p.companyName}</>}
    </>
  )
}

/**
 * "Did you apply to <title> at <company>?" — one compact prompt for every employer
 * application the member opened in the last 7 days and hasn't logged. Yes logs it in
 * My jobs (and toward Candidate+), then shows the updated Candidate+ count.
 */
export function ApplyPrompts({ prompts }: { prompts: ApplyPromptView[] }) {
  const [answered, setAnswered] = useState<Record<string, PromptAnswer>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const open = prompts.filter((p) => !answered[p.trackedJobId])

  if (open.length === 0) {
    if (!progress) return null
    return (
      <p role="status" className="rounded-md border border-success/40 bg-success/5 px-3 py-2 text-sm text-foreground">
        Logged in{' '}
        <Link href="/dashboard/find-my-job?tab=my_jobs" className="underline underline-offset-4">
          My jobs
        </Link>
        . {progress}
      </p>
    )
  }

  function answer(ids: string[], a: PromptAnswer, key: string) {
    setBusy(key)
    setError(null)
    startTransition(async () => {
      try {
        const r = await answerApplyPrompts(ids, a)
        if (!r.ok) return setError(r.error)
        setAnswered((x) => ({ ...x, ...Object.fromEntries(ids.map((id) => [id, a])) }))
        if (r.progress) setProgress(r.progress)
      } catch {
        setError('We couldn’t save that. Check your connection and try again.')
      } finally {
        setBusy(null)
      }
    })
  }

  const single = open.length === 1 ? open[0] : null

  return (
    <div
      className={cn('space-y-2 rounded-md border border-border bg-muted/40 px-3 py-2', busy && 'cursor-wait')}
      aria-live="polite"
      aria-busy={!!busy}
    >
      {single ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-foreground">Did you apply to {jobName(single)}?</p>
          <Answers ids={[single.trackedJobId]} busyKey={busy} rowKey={single.trackedJobId} onAnswer={answer} label={`Did you apply to ${single.title}?`} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Did you apply to these {open.length} jobs you opened?</p>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => answer(open.map((p) => p.trackedJobId), 'applied', 'all')}
              className={cn(buttonClass, busy && 'cursor-wait')}
            >
              {busy === 'all' ? 'Logging…' : `Yes, all ${open.length}`}
            </button>
          </div>
          <ul className="space-y-1.5">
            {open.map((p) => (
              <li key={p.trackedJobId} className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-foreground">
                  {jobName(p)} <span className="text-xs text-muted-foreground">· opened {p.clickedOn}</span>
                </p>
                <Answers ids={[p.trackedJobId]} busyKey={busy} rowKey={p.trackedJobId} onAnswer={answer} label={`Did you apply to ${p.title}?`} />
              </li>
            ))}
          </ul>
        </>
      )}
      {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function Answers({
  ids,
  rowKey,
  busyKey,
  onAnswer,
  label,
}: {
  ids: string[]
  rowKey: string
  busyKey: string | null
  onAnswer: (ids: string[], a: PromptAnswer, key: string) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1">
      {ANSWERS.map((a) => (
        <button
          key={a.key}
          type="button"
          disabled={!!busyKey}
          aria-busy={busyKey === rowKey}
          onClick={() => onAnswer(ids, a.key, rowKey)}
          className={cn(buttonClass, busyKey && 'cursor-wait')}
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}
