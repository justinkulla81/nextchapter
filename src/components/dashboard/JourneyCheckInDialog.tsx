'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { usePostHog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { answerJourneyCheckIn } from '@/app/dashboard/journey-actions'
import type { CheckInAnswer } from '@/lib/journey/journey'

// "Still searching?" as a small, optional pop-up in the corner, at the pace of
// the member's stage (weekly while applying, monthly while exploring). One
// question; any answer is fine and the plan follows it. People move back and
// forth between stages, so this is how the stage stays true without a form.
const SESSION_KEY = 'nc-journey-checkin-seen'

const MAIN: Array<{ key: CheckInAnswer; label: string }> = [
  { key: 'nothing', label: 'Yes, still searching' },
  { key: 'interviewing', label: 'I have an interview' },
  { key: 'offer', label: 'I got an offer' },
  { key: 'managing', label: 'I am not looking right now' },
]
const MORE: Array<{ key: CheckInAnswer; label: string }> = [
  { key: 'ready', label: 'I am ready to start applying' },
  { key: 'laid_off', label: 'I was laid off' },
  { key: 'landed', label: 'I started a new job' },
  { key: 'promotion', label: 'I am going for a promotion' },
  { key: 'career_change', label: 'I am changing careers' },
  { key: 'time_off', label: 'I am taking time off' },
  { key: 'building', label: 'I am starting something of my own' },
]

export function JourneyCheckInDialog({ stageLabel }: { stageLabel: string }) {
  const posthog = usePostHog()
  const [open, setOpen] = useState(false)
  const [more, setMore] = useState(false)
  const [done, setDone] = useState<{ message?: string; next?: { href: string; label: string } } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let seen = false
    try {
      seen = sessionStorage.getItem(SESSION_KEY) === '1'
    } catch {
      /* storage blocked */
    }
    if (seen) return
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        /* storage blocked */
      }
      setOpen(true)
      posthog?.capture('journey_check_in_shown', { stage: stageLabel })
    }, 1500)
    return () => clearTimeout(t)
  }, [posthog, stageLabel])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  function choose(key: CheckInAnswer) {
    setError(null)
    start(async () => {
      const r = await answerJourneyCheckIn(key)
      if (r.error) return setError(r.error)
      posthog?.capture('journey_check_in_answered', { answer: key, fromStage: stageLabel, source: 'popup' })
      setDone(r)
    })
  }

  const btn = 'rounded-lg border border-border bg-white px-3 py-2 text-left text-sm font-medium hover:bg-muted disabled:cursor-wait'
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Quick check-in"
      className={cn(
        'fixed right-4 bottom-20 z-40 w-[min(22rem,calc(100vw-2rem))] space-y-3 rounded-xl border border-border bg-white p-4 shadow-lg lg:bottom-6',
        pending && 'cursor-wait'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Quick check-in</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Dismiss check-in" className="-m-1 rounded p-1 text-muted-foreground hover:text-foreground">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {done ? (
        <div role="status" className="space-y-2 text-sm">
          <p className="font-medium">{done.message ?? 'Thanks, your plan now fits.'}</p>
          {done.next && (
            <Link href={done.next.href} className="font-medium text-brand underline underline-offset-4">
              {done.next.label}
            </Link>
          )}
        </div>
      ) : (
        <>
          <div>
            <p className="font-semibold">Still searching?</p>
            <p className="mt-0.5 text-sm text-muted-foreground">A quick check so your plan fits. Any answer is fine.</p>
          </div>
          <div className="grid gap-2" role="group" aria-label="Still searching?">
            {MAIN.map((a) => (
              <button key={a.key} type="button" disabled={pending} onClick={() => choose(a.key)} className={btn}>
                {a.label}
              </button>
            ))}
            {more &&
              MORE.map((a) => (
                <button key={a.key} type="button" disabled={pending} onClick={() => choose(a.key)} className={btn}>
                  {a.label}
                </button>
              ))}
          </div>
          {!more && (
            <button type="button" onClick={() => setMore(true)} className="text-sm font-medium text-brand underline underline-offset-4">
              Something else changed
            </button>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error} Try again in a moment.
            </p>
          )}
        </>
      )}
      <span className="sr-only">Currently set to {stageLabel}.</span>
    </div>
  )
}
