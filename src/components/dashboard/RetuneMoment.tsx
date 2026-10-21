'use client'

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TrackedLink } from '@/components/dashboard/TrackedLink'
import { retuneSearch } from '@/app/dashboard/retune-actions'
import type { RetuneResult, RetuneTrigger } from '@/lib/personalization/match-verdict'

// "Retuning your search" (owner's honesty rule): the step list shows only while the server is
// really re-running the member's matching — it is bound to the server action's pending state,
// with no timers and no added delay — and every number in the card comes from that run.

const n = (x: number) => x.toLocaleString()

export const RETUNE_STEPS = ['Reading your profile', 'Checking every open job at your level', 'Matching level, field, location, tools'] as const

/** What the moment shows. Pure: rendered from the action's pending state and its result only. */
export function RetuneView({
  pending,
  result,
  error,
  showBoardLink = true,
}: {
  pending: boolean
  result: RetuneResult | null | undefined
  error: string | null
  showBoardLink?: boolean
}) {
  if (pending) {
    return (
      <section aria-live="polite" aria-busy="true" className="cursor-wait space-y-2 rounded-lg border border-border bg-card p-4 text-sm" data-retune="pending">
        <p className="font-medium text-foreground">Retuning your search…</p>
        <ol className="space-y-1">
          {RETUNE_STEPS.map((step) => (
            <li key={step} className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden />
              {step}
            </li>
          ))}
        </ol>
      </section>
    )
  }
  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    )
  }
  if (result === undefined) return null
  if (result === null) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Saved. Add your function on your profile so we can match jobs to you.
      </p>
    )
  }
  const { before, after } = result
  const moved = !before || before.matches !== after.matches || before.strong !== after.strong
  return (
    <section role="status" aria-live="polite" className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm" data-retune="done">
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1">
          <Check className="size-3.5 text-success" aria-hidden /> Read {n(result.signals)} signal{result.signals === 1 ? '' : 's'} from your profile
        </li>
        <li className="flex items-center gap-1">
          <Check className="size-3.5 text-success" aria-hidden /> Checked {n(result.checked)} jobs
        </li>
        <li className="flex items-center gap-1">
          <Check className="size-3.5 text-success" aria-hidden /> Matched level, field, location, tools in {(result.ms / 1000).toFixed(1)} s
        </li>
      </ol>
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Your matches</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">
          {before && moved ? (
            <>
              {n(before.matches)} <span aria-label="to">→</span> {n(after.matches)}
            </>
          ) : (
            n(after.matches)
          )}{' '}
          <span className="text-base font-normal text-muted-foreground">job{after.matches === 1 ? '' : 's'} that fit on every count</span>
        </p>
        <p className="text-muted-foreground">
          {before && before.strong !== after.strong ? `Strong fits: ${n(before.strong)} → ${n(after.strong)}` : `${n(after.strong)} strong fit${after.strong === 1 ? '' : 's'}`}
          {before && !moved && ' — no change to which jobs match; this sharpens how each one is checked.'}
        </p>
      </div>
      {result.reasons.length > 0 && (
        <ul className="space-y-0.5">
          {result.reasons.map((r) => (
            <li key={r} className="text-foreground">
              {r}
            </li>
          ))}
        </ul>
      )}
      {result.notes.map((note) => (
        <p key={note} className="text-muted-foreground">
          {note}
        </p>
      ))}
      {showBoardLink && (
        <TrackedLink
          href="/dashboard/find-my-job#job-recommendations"
          event="retune_board_opened"
          properties={{ trigger: result.trigger, after: after.matches }}
          className="font-medium text-primary underline underline-offset-4"
        >
          See your matches
        </TrackedLink>
      )}
    </section>
  )
}

// One retune at a time, shown by RetuneHost (dashboard layout) so it outlives the form that
// asked for it: saves revalidate their page, and the form (or the prompt) is often gone after.
type Request = { id: number; trigger: RetuneTrigger }
let current: Request | null = null
let nextId = 1
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Ask the host to re-run the member's matching now (call right after a save succeeded). */
export function startRetune(trigger: RetuneTrigger): void {
  current = { id: nextId++, trigger }
  for (const fn of listeners) fn()
}

/** The floating "Retuning your search" card. Mounted once, in the dashboard layout. */
export function RetuneHost() {
  const router = useRouter()
  const request = useSyncExternalStore(subscribe, () => current, () => null)
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<RetuneResult | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [closed, setClosed] = useState<number | null>(null)
  const ran = useRef(0)
  useEffect(() => {
    if (!request || ran.current === request.id) return
    ran.current = request.id
    startTransition(async () => {
      setError(null)
      setResult(undefined)
      const r = await retuneSearch(request.trigger).catch(() => null)
      if (!r || !r.ok) {
        setError(r && !r.ok ? r.error : "We couldn't re-run your matches just now. Your change is saved.")
        return
      }
      setResult(r.result)
      router.refresh()
    })
  }, [request, router])
  if (!request || closed === request.id) return null
  return (
    <div className={cn('fixed right-4 bottom-20 z-50 w-[min(26rem,calc(100vw-2rem))] shadow-lg lg:bottom-6', pending && 'cursor-wait')}>
      <div className="relative">
        <RetuneView pending={pending} result={result} error={error} />
        {!pending && (
          <button
            type="button"
            aria-label="Close"
            onClick={() => setClosed(request.id)}
            className="absolute top-2 right-2 rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * For a form whose action returns nothing on success: goes up by one each time a submit
 * finishes without an error.
 */
export function useSaveSucceeded(pending: boolean, failed: boolean): number {
  const [count, setCount] = useState(0)
  const [wasPending, setWasPending] = useState(pending)
  if (wasPending !== pending) {
    setWasPending(pending)
    if (wasPending && !pending && !failed) setCount((c) => c + 1)
  }
  return count
}

/**
 * Retune after a useActionState form saves, but only when what matching reads changed:
 * changeKey is that part of the form (JSON), recorded by onSubmit; 'always' retunes on every save.
 */
export function useRetuneAfterSave(trigger: RetuneTrigger, pending: boolean, failed: boolean, changeKey = 'always'): { onSubmit: () => void } {
  const saves = useSaveSucceeded(pending, failed)
  const [savedKey, setSavedKey] = useState(changeKey === 'always' ? null : changeKey)
  const [submittedKey, setSubmittedKey] = useState<string | null>(null)
  const [seen, setSeen] = useState(saves)
  const [runKey, setRunKey] = useState(0)
  if (seen !== saves) {
    setSeen(saves)
    if (submittedKey !== null && (changeKey === 'always' || submittedKey !== savedKey)) {
      setSavedKey(submittedKey)
      setRunKey((k) => k + 1)
    }
  }
  useEffect(() => {
    if (runKey > 0) startRetune(trigger)
  }, [runKey, trigger])
  return { onSubmit: () => setSubmittedKey(changeKey) }
}
