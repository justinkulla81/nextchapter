'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { usePostHog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { statusUnlock, type MenuMode } from '@/lib/journey/menu'
import { answerJourneyCheckIn } from '@/app/dashboard/journey-actions'

// "Turn on more tools": the sidebar shows only what helps in the member's
// current situation. Tools that a change of situation would turn on stay
// visible but muted; this box says why they are off and lets the member update
// their status in one click. It is the same change as "Has anything changed?".
export function StatusUnlockBox({ mode, lockedTools }: { mode: MenuMode; lockedTools: string[] }) {
  const unlock = statusUnlock(mode)
  const router = useRouter()
  const posthog = usePostHog()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  if (!unlock) return null

  return (
    <section aria-labelledby="status-unlock-title" className={cn('mx-2 rounded-lg border border-border bg-off-white p-3', pending && 'cursor-wait')}>
      <h2 id="status-unlock-title" className="text-xs font-semibold text-foreground">
        Turn on more tools
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{unlock.why}</p>
      <p className="mt-1 text-xs text-muted-foreground">Off for now: {lockedTools.join(', ')}.</p>
      <ul className="mt-2 space-y-2">
        {unlock.answers.map((a) => (
          <li key={a.answer}>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null)
                  const r = await answerJourneyCheckIn(a.answer)
                  if (r.error) return setError(r.error)
                  posthog?.capture('status_updated_from_menu', { answer: a.answer, mode, lockedTools })
                  router.refresh()
                })
              }
              className={cn(
                'w-full rounded-md border border-brand px-2 py-1.5 text-left text-xs font-medium text-brand hover:bg-brand/10',
                pending && 'cursor-wait opacity-70'
              )}
            >
              {pending ? 'Updating…' : a.label}
            </button>
            <p className="mt-1 text-[11px] text-muted-foreground">{a.because}</p>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error} Try again, or change it on your Privacy page.
        </p>
      )}
    </section>
  )
}
