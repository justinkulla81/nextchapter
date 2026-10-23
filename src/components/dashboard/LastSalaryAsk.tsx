'use client'

import { useActionState, useId, useSyncExternalStore } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { saveLastSalaryAction } from '@/app/dashboard/move-plan/actions'

export type LastSalarySource = 'move_plan' | 'job_detail' | 'pivot'

const SKIP_KEY = 'last_salary_ask_skipped'
const field = 'h-11 w-full max-w-60 rounded-xl border border-border bg-white px-3.5 text-base text-ink'
const quiet = 'inline-flex h-11 items-center rounded-full border border-border px-6 text-base font-semibold text-ink hover:bg-muted disabled:cursor-wait disabled:opacity-70'

// Skip state lives in the browser (session storage, with an in-memory fallback for private windows).
const skipListeners = new Set<() => void>()
let skippedInMemory = false
const subscribeSkip = (cb: () => void) => {
  skipListeners.add(cb)
  return () => {
    skipListeners.delete(cb)
  }
}
const markSkipped = () => {
  skippedInMemory = true
  skipListeners.forEach((l) => l())
}

function skippedThisSession(): boolean {
  try {
    return skippedInMemory || window.sessionStorage.getItem(SKIP_KEY) === '1'
  } catch {
    return skippedInMemory
  }
}

/**
 * Asks for the last annual salary where it explains a comparison, never as a stand-alone form. The copy says why we ask
 * and that only the member sees it. "Skip for now" hides every ask for the rest of the browser session.
 */
export function LastSalaryAsk({
  heading,
  body,
  source,
  contextId,
  homeName,
}: {
  heading: string
  body: string
  source: LastSalarySource
  /** The job or occupation the ask sits under, sent with the events. */
  contextId?: string
  /** The place the comparison is made against, named in the helper line. */
  homeName?: string | null
}) {
  const posthog = usePostHog()
  const id = useId()
  // null until the browser has been checked, so a skipped ask never flashes.
  const skipped = useSyncExternalStore(subscribeSkip, skippedThisSession, () => null)
  const [state, formAction, pending] = useActionState(saveLastSalaryAction, null)
  if (skipped !== false || state?.ok) return null
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="text-base font-semibold text-ink">{heading}</h3>
      <p className="text-sm text-ink">{body}</p>
      <form action={formAction} className={pending ? 'cursor-wait space-y-3' : 'space-y-3'}>
        <input type="hidden" name="source" value={source} />
        {contextId && <input type="hidden" name="contextId" value={contextId} />}
        <label htmlFor={`${id}-salary`} className="block text-sm font-semibold text-ink">Last annual salary, before taxes</label>
        <input id={`${id}-salary`} name="salary" inputMode="numeric" autoComplete="off" placeholder="$ 120,000" className={field} />
        <p className="text-sm text-muted-foreground">
          Why we ask: so the comparison uses your pay{homeName ? `, in ${homeName} dollars` : ''}, not a typical one. Only you see it, and you can skip this.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={quiet}>{pending ? 'Saving…' : 'Save and compare'}</button>
          <button
            type="button"
            onClick={() => {
              try { window.sessionStorage.setItem(SKIP_KEY, '1') } catch { /* private window: it only stays hidden until reload */ }
              markSkipped()
              posthog?.capture('last_salary_skipped', { source, contextId: contextId ?? null })
            }}
            className="text-base font-medium underline underline-offset-4"
          >
            Skip for now
          </button>
        </div>
        {state?.error && <p role="alert" className="text-base text-destructive">{state.error}</p>}
      </form>
    </section>
  )
}
