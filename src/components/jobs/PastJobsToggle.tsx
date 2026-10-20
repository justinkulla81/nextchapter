'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// "Include past jobs" on the board search (default off): adds a separate, clearly
// labelled list of closed jobs below the live board — for research into what a
// company hires for, typical titles and pay. Lives in the URL (past=1).
export function PastJobsToggle() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const on = searchParams.get('past') === '1'

  function toggle() {
    const next = new URLSearchParams(searchParams.toString())
    if (on) next.delete('past')
    else next.set('past', '1')
    posthog.capture('past_jobs_toggle_changed', { on: !on, q: searchParams.get('q') ?? '' })
    const query = next.toString()
    startTransition(() => router.push(`${pathname}${query ? `?${query}` : ''}${on ? '' : '#past-jobs'}`, { scroll: false }))
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      className={cn('inline-flex items-center gap-2 text-sm text-muted-foreground', pending && 'cursor-wait')}
    >
      <span className={cn('relative inline-flex h-5 w-9 shrink-0 rounded-full border border-border transition-colors', on ? 'bg-foreground' : 'bg-muted')} aria-hidden>
        <span className={cn('absolute top-0.5 size-3.5 rounded-full bg-background shadow transition-all', on ? 'left-4' : 'left-0.5')} />
      </span>
      Include past jobs (closed, for research)
    </button>
  )
}
