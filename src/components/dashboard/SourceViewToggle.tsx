'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { boardHref } from '@/lib/jobs/board-url'
import { SOURCE_VIEWS, SOURCE_VIEW_HINT, SOURCE_VIEW_LABEL, type SourceView } from '@/lib/jobs/job-source'

/**
 * From employers / Employers and recruiters (job-source.ts) as two adjacent buttons; From employers is
 * the default. The choice goes in the URL (`source`), so it works with the search and every other filter.
 * Fires job_source_view_changed {view, from, surface, moreCount}.
 */
export function SourceViewToggle({ surface, current, moreCount }: { surface: string; current: SourceView; moreCount: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function select(view: SourceView) {
    if (view === current) return
    posthog.capture('job_source_view_changed', { view, from: current, surface, moreCount })
    startTransition(() => {
      router.replace(boardHref(searchParams, { source: view === 'direct' ? null : view }, { pathname }), { scroll: false })
    })
  }

  return (
    <div className="space-y-1">
      <div role="group" aria-label="Which jobs to show" className={cn('flex gap-1', pending && 'cursor-wait')}>
        {SOURCE_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => select(v)}
            disabled={pending}
            aria-pressed={current === v}
            aria-busy={pending}
            className={cn(
              'rounded-md border px-2 py-1 text-sm',
              current === v ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground',
              pending && 'cursor-wait'
            )}
          >
            {SOURCE_VIEW_LABEL[v]}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {SOURCE_VIEW_HINT[current]}
        {current === 'direct' && moreCount > 0 && ` ${moreCount.toLocaleString()} more from recruiters and job boards.`}
      </p>
    </div>
  )
}

/** The empty state's way out: switch to Employers and recruiters. Fires job_source_view_changed. */
export function ShowAllSourcesButton({ count, surface }: { count: number; surface: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        posthog.capture('job_source_view_changed', { view: 'all', from: 'direct', surface, moreCount: count })
        startTransition(() => router.replace(boardHref(searchParams, { source: 'all' }, { pathname }), { scroll: false }))
      }}
      className={cn('inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted', pending && 'cursor-wait')}
    >
      Show {count.toLocaleString()} recruiter and job-board listings
    </button>
  )
}
