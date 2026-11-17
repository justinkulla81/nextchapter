'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { boardHref } from '@/lib/jobs/board-url'
import { SCOPE_HINT, SCOPE_LABEL, SEARCH_SCOPES, type SearchScope } from '@/lib/jobs/search-scope'
import { saveSearchScope } from '@/app/dashboard/find-my-job/scope-actions'

/**
 * Narrow / Broader / Everything: how much past the member's home the board reads
 * (search-scope.ts). It takes the place of the Narrow / Wide buttons (BreadthToggle): the
 * choice goes in the URL (`scope`), is saved as the member's preference, and sets how far
 * past their own field the board reaches. `preview` runs it without the server, for dev-preview.
 *
 * Widening is a strategy, not a switch: while `needsStrategy` (widen-strategy.ts: no strategy finished and nothing
 * outside home switched on), Broader and Everything open the Widen your search page instead, where the member sees
 * where the jobs are and picks what to add. After that the switch works directly, with "Change your strategy" beside it.
 */
export const WIDEN_HREF = '/dashboard/find-my-job/widen'

export function ScopeToggle({ surface, current, preview = false, onPreview, needsStrategy = false }: { surface: string; current: SearchScope; preview?: boolean; onPreview?: (s: SearchScope) => void; needsStrategy?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [shown, setShown] = useState(current)
  const value = preview ? shown : current

  function select(scope: SearchScope) {
    if (scope === value && !(needsStrategy && scope !== 'narrow')) return
    if (needsStrategy && scope !== 'narrow') {
      posthog.capture('search_strategy_started', { source: 'scope_toggle', to: scope, surface })
      if (preview) return
      startTransition(() => router.push(`${WIDEN_HREF}?from=board`))
      return
    }
    posthog.capture('search_scope_changed', { from: value, to: scope, surface })
    if (preview) {
      setShown(scope)
      onPreview?.(scope)
      return
    }
    startTransition(async () => {
      await saveSearchScope(scope).catch(() => undefined)
      router.replace(boardHref(searchParams, { scope }, { pathname }), { scroll: false })
    })
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-3', pending && 'cursor-wait')}>
      <span id="scope-label" className="text-sm font-medium text-ink">
        Where to look
      </span>
      <div role="group" aria-labelledby="scope-label" className="flex gap-1">
        {SEARCH_SCOPES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => select(s)}
            disabled={pending}
            aria-pressed={value === s}
            aria-busy={pending}
            title={SCOPE_HINT[s]}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm',
              value === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground',
              pending && 'cursor-wait'
            )}
          >
            {SCOPE_LABEL[s]}
          </button>
        ))}
      </div>
      <span className="text-sm text-muted-foreground" aria-live="polite">
        {SCOPE_HINT[value]}
      </span>
      <Link
        href={`${WIDEN_HREF}?from=board`}
        onClick={() => posthog.capture('search_strategy_started', { source: 'scope_link', to: value, surface, first: needsStrategy })}
        className="text-sm font-medium text-brand underline underline-offset-4"
      >
        {needsStrategy ? 'Plan where to widen' : 'Change your strategy'}
      </Link>
    </div>
  )
}
