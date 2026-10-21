'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { boardHref } from '@/lib/jobs/board-url'
import { OPEN_FILTER_HINT, OPEN_FILTER_LABEL, OPEN_FILTER_VALUE } from '@/lib/jobs/posting-signals'

/**
 * "Open to career changers / AI-upskilled" (off by default): only jobs whose posting says it
 * welcomes career changers, transferable skills, non-traditional paths or people learning AI
 * (posting-signals.ts). Lives in the URL (`open=changers`, board-url.ts), so it works with the
 * search and every other filter. Fires posting_signal_filter_changed {on, surface, count}.
 */
export function OpenToChangersFilter({ surface, on, count }: { surface: string; on: boolean; count?: number | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-busy={pending}
      disabled={pending}
      title={OPEN_FILTER_HINT}
      className={cn(
        'rounded-md border px-2 py-1 text-sm',
        on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground',
        pending && 'cursor-wait'
      )}
      onClick={() => {
        posthog.capture('posting_signal_filter_changed', { on: !on, filter: 'open_to_changers', surface, count: count ?? null })
        startTransition(() => router.replace(boardHref(searchParams, { open: on ? null : OPEN_FILTER_VALUE }, { pathname }), { scroll: false }))
      }}
    >
      {OPEN_FILTER_LABEL}
      {on && typeof count === 'number' && <span className="ml-1 text-xs text-primary-foreground/80">{count.toLocaleString()}</span>}
    </button>
  )
}
