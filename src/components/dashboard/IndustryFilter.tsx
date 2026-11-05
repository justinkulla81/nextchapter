'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { boardHref } from '@/lib/jobs/board-url'
import { INDUSTRY_GROUP_ORDER, INDUSTRY_OPTIONS, INDUSTRY_SLUGS } from '@/lib/segments/industry-options'

/**
 * Narrows the board to one industry through the `industry` URL parameter, with the same jobs as that industry's public page
 * (the page's own rules, segments/defs.ts), so a member who comes from /jobs/industry/retail sees the same list, ranked for
 * them. Thirty-five choices, so a select, grouped as the public industry hub is. With no choice the board shows every industry.
 */
export function IndustryFilter({ surface }: { surface: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const raw = searchParams.get('industry') ?? ''
  const current = INDUSTRY_SLUGS.has(raw) ? raw : ''

  function onChange(value: string) {
    posthog.capture('job_industry_filter_changed', { surface, industry: value || 'ALL', from: current || 'ALL' })
    startTransition(() => router.replace(boardHref(searchParams, { industry: value || null }, { pathname }), { scroll: false }))
  }

  return (
    <label className={cn('flex items-center gap-2 text-sm text-muted-foreground', pending && 'cursor-wait')}>
      Industry
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        aria-busy={pending}
        className={cn('rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground', pending && 'cursor-wait')}
      >
        <option value="">All industries</option>
        {INDUSTRY_GROUP_ORDER.map((group) => (
          <optgroup key={group} label={group}>
            {INDUSTRY_OPTIONS.filter((o) => o.group === group).map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
