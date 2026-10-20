'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { boardHref } from '@/lib/jobs/board-url'
import { AI_VIEWS, AI_VIEW_JOB_HINT, AI_VIEW_JOB_LABEL, AI_VIEW_SKILL_LABEL, type AiView } from '@/lib/jobs/ai-view'

/**
 * AI / Non-AI / All (ai-view.ts) as three adjacent buttons; All is the default.
 * - kind "jobs" (the board): the choice goes in the URL (`ai`, board-url.ts), so it works with
 *   the search, Narrow / Wide and every other filter, and a shared link keeps it.
 * - kind "skills" (skills gap, Learning): local; the parent filters its own list via onChange.
 * Fires ai_filter_changed {view, surface}.
 */
export function AiViewToggle({
  surface,
  kind,
  current,
  counts,
  onChange,
}: {
  surface: string
  kind: 'jobs' | 'skills'
  current: AiView
  /** Items each view shows, with every other filter on; omitted shows no counts. */
  counts?: Partial<Record<AiView, number>>
  /** Local mode: called with the new view. Omitted: the board URL changes instead. */
  onChange?: (view: AiView) => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const label = kind === 'jobs' ? AI_VIEW_JOB_LABEL : AI_VIEW_SKILL_LABEL

  function select(view: AiView) {
    if (view === current) return
    posthog.capture('ai_filter_changed', { view, surface, from: current, count: counts?.[view] ?? null })
    if (onChange) {
      onChange(view)
      return
    }
    startTransition(() => {
      router.replace(boardHref(searchParams, { ai: view }, { pathname }), { scroll: false })
    })
  }

  return (
    <div
      role="group"
      aria-label={kind === 'jobs' ? 'Jobs that ask for AI skills' : 'AI skills or other skills'}
      className={cn('flex gap-1', pending && 'cursor-wait')}
    >
      {AI_VIEWS.map((v) => {
        const n = counts?.[v]
        return (
          <button
            key={v}
            type="button"
            onClick={() => select(v)}
            disabled={pending}
            aria-pressed={current === v}
            aria-busy={pending}
            title={kind === 'jobs' ? AI_VIEW_JOB_HINT[v] : undefined}
            className={cn(
              'rounded-md border px-2 py-1 text-sm',
              current === v ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground',
              pending && 'cursor-wait'
            )}
          >
            {label[v]}
            {n !== undefined && (
              <span className={cn('ml-1 text-xs', current === v ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{n.toLocaleString()}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
