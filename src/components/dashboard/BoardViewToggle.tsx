'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { boardHref } from '@/lib/jobs/board-url'

const VIEWS = [
  { key: 'all', label: 'All jobs' },
  { key: 'fresh', label: 'Last 72 hours' },
  { key: 'low_competition', label: 'Likely fewer applicants' },
] as const

/** Switches the job board between all jobs, fresh ones and low-competition ones (the `view` URL parameter). */
export function BoardViewToggle({ surface }: { surface: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const current = searchParams.get('view') ?? 'all'

  function select(view: string) {
    if (view === current) return
    posthog.capture('job_board_view_changed', { surface, view })
    // Keeps the search (q, loc, remote, sort) and every other filter on.
    startTransition(() => router.replace(boardHref(searchParams, { view }, { pathname }), { scroll: false }))
  }

  return (
    <div role="group" aria-label="Which jobs to show" className={cn('flex gap-1', pending && 'cursor-wait')}>
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => select(v.key)}
          disabled={pending}
          aria-pressed={current === v.key}
          className={cn(
            'rounded-md border px-2 py-1 text-sm',
            current === v.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground',
            pending && 'cursor-wait'
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}
