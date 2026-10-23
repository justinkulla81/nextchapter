'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { boardHref } from '@/lib/jobs/board-url'
import { ENTRY_FILTERS, toggleEntryParam, type EntryFilterKey } from '@/lib/jobs/entry-filters'

/**
 * "No experience needed" and "Entry-level + AI" (off by default; entry-filters.ts). They live in the URL
 * (`entry=noexp,ai`, board-url.ts), so they work with the search and every other filter. Fires
 * entry_filter_changed {filter, on, surface, count, active}.
 */
export function EntryFilterChips({ surface, on, count }: { surface: string; on: readonly EntryFilterKey[]; count?: number | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Entry-level filters">
      {ENTRY_FILTERS.map((f) => {
        const active = on.includes(f.key)
        return (
          <button
            key={f.key}
            type="button"
            aria-pressed={active}
            aria-busy={pending}
            disabled={pending}
            title={f.hint}
            className={cn(
              'rounded-md border px-2 py-1 text-sm',
              active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground',
              pending && 'cursor-wait'
            )}
            onClick={() => {
              const next = toggleEntryParam(on, f.key)
              posthog.capture('entry_filter_changed', { filter: f.key, on: !active, surface, count: count ?? null, active: next ? next.split(',') : [] })
              startTransition(() => router.replace(boardHref(searchParams, { entry: next }, { pathname }), { scroll: false }))
            }}
          >
            {f.label}
            {active && typeof count === 'number' && <span className="ml-1 text-xs text-primary-foreground/80">{count.toLocaleString()}</span>}
          </button>
        )
      })}
    </div>
  )
}
