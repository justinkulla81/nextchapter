'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { decideDismissPreference, undoDismissBoardJob } from '@/app/dashboard/find-my-job/dismiss-actions'

export interface PassedOnPreference {
  id: string
  kind: string
  label: string
  count: number
  action: string
  ask: boolean
}

export interface PassedOnJob {
  jobId: string
  title: string
  companyName: string | null
  reasons: string[]
  dismissedOn: string
}

/**
 * What the member's dismissals changed, where it changes results: "Because you passed on
 * …", the "Hide all X?" question after repeated reasons, and a list to review and undo
 * (learned preferences and the jobs themselves).
 */
export function PassedOnPanel({
  because,
  preferences,
  jobs,
  hiddenCount,
}: {
  because: string | null
  preferences: PassedOnPreference[]
  jobs: PassedOnJob[]
  /** Jobs the dismissals left off this view. */
  hiddenCount: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [gone, setGone] = useState<Set<string>>(new Set())
  const ask = preferences.find((p) => p.ask && !gone.has(p.id))

  function decide(p: PassedOnPreference, decision: 'hide' | 'keep' | 'undo') {
    startTransition(async () => {
      const r = await decideDismissPreference(p.id, decision).catch(() => null)
      if (!r?.ok) return
      if (decision === 'hide') posthog.capture('dismiss_preference_applied', { kind: p.kind, action: 'hide', source: 'ask' })
      if (decision === 'undo') posthog.capture('dismiss_undone', { kind: p.kind, scope: 'preference' })
      setGone((g) => new Set(g).add(p.id))
      router.refresh()
    })
  }

  function undoJob(j: PassedOnJob) {
    startTransition(async () => {
      const r = await undoDismissBoardJob(j.jobId).catch(() => null)
      if (!r?.ok) return
      posthog.capture('dismiss_undone', { jobId: j.jobId, scope: 'job' })
      setGone((g) => new Set(g).add(j.jobId))
      router.refresh()
    })
  }

  if (!because && !ask && jobs.length === 0) return null
  const prefs = preferences.filter((p) => !gone.has(p.id))
  const passed = jobs.filter((j) => !gone.has(j.jobId))
  return (
    <div className={cn('space-y-2 text-sm', pending && 'cursor-wait')}>
      {ask && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2" role="status">
          <span className="text-foreground">
            You&apos;ve passed on {ask.count} {ask.label}. Hide all {ask.label}?
          </span>
          <Button size="sm" onClick={() => decide(ask, 'hide')} disabled={pending}>
            Hide all {ask.label}
          </Button>
          <Button size="sm" variant="outline" onClick={() => decide(ask, 'keep')} disabled={pending}>
            Keep showing them
          </Button>
        </div>
      )}
      {(because || passed.length > 0) && (
        <details className="text-muted-foreground">
          <summary className="cursor-pointer">
            {because ?? `You passed on ${passed.length} job${passed.length === 1 ? '' : 's'}.`}
            {hiddenCount > 0 && ` ${hiddenCount.toLocaleString()} job${hiddenCount === 1 ? '' : 's'} left out here.`}{' '}
            <span className="text-primary underline underline-offset-4">Review</span>
          </summary>
          <div className="mt-2 space-y-3 rounded-md border border-border p-3">
            {prefs.length > 0 && (
              <ul className="space-y-1">
                {prefs.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-foreground">
                      {p.action === 'downweight' ? 'Moved down' : 'Hidden'}: {p.label}
                      <span className="text-muted-foreground"> · from {p.count} job{p.count === 1 ? '' : 's'} you passed on</span>
                    </span>
                    <button type="button" onClick={() => decide(p, 'undo')} disabled={pending} className="text-primary underline underline-offset-4">
                      Undo
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {passed.length > 0 && (
              <ul className="space-y-1">
                {passed.map((j) => (
                  <li key={j.jobId} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="text-foreground">{j.title}</span>
                      {j.companyName && ` at ${j.companyName}`} · {j.dismissedOn}
                      {j.reasons.length > 0 && ` · ${j.reasons.join(', ')}`}
                    </span>
                    <button type="button" onClick={() => undoJob(j)} disabled={pending} className="text-primary underline underline-offset-4">
                      Show it again
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      )}
    </div>
  )
}
