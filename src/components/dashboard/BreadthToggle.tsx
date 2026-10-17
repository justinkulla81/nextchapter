'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { boardHref } from '@/lib/jobs/board-url'
import { BREADTHS, BREADTH_HINT, BREADTH_LABEL, type Breadth } from '@/lib/jobs/search-breadth'
import { saveBoardBreadth } from '@/app/dashboard/find-my-job/breadth-actions'

/**
 * Narrow / Wide: how far past the member's own field the board reaches
 * (search-breadth.ts). Two buttons; the choice goes in the URL (`breadth`) and is
 * saved as the member's preference, which job emails follow too.
 */
export function BreadthToggle({
  surface,
  current,
  counts,
}: {
  surface: string
  current: Breadth
  /** Jobs each breadth shows, with every other filter on. */
  counts: Record<Breadth, number>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function select(breadth: Breadth) {
    if (breadth === current) return
    posthog.capture('search_breadth_changed', { breadth, surface, from: current, jobs: counts[breadth] })
    startTransition(async () => {
      await saveBoardBreadth(breadth).catch(() => undefined)
      router.replace(boardHref(searchParams, { breadth }, { pathname }), { scroll: false })
    })
  }

  return (
    <div role="group" aria-label="How wide to search" className={cn('flex gap-1', pending && 'cursor-wait')}>
      {BREADTHS.map((b) => (
        <button
          key={b}
          type="button"
          onClick={() => select(b)}
          disabled={pending}
          aria-pressed={current === b}
          aria-busy={pending}
          title={BREADTH_HINT[b]}
          className={cn(
            'rounded-md border px-2 py-1 text-sm',
            current === b ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground',
            pending && 'cursor-wait'
          )}
        >
          {BREADTH_LABEL[b]}
          <span className={cn('ml-1 text-xs', current === b ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
            {counts[b].toLocaleString()}
          </span>
        </button>
      ))}
    </div>
  )
}
