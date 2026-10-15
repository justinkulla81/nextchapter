'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { GREAT_FILTERS, GREAT_FILTER_LABEL, greatParam, parseGreatParam, type GreatFilter } from '@/lib/jobs/great-employer-display'

const HINT: Record<GreatFilter, string> = {
  pay: 'Employers whose posted pay runs above market, jobs that post above-market pay, and employers known for pay',
  benefits: 'Jobs that list strong benefits, and employers known for their benefits',
}

/**
 * "Great pay" and "Great benefits": two on/off buttons side by side (the `great`
 * URL parameter, so a reload or shared link keeps them). Both on shows jobs
 * that meet both.
 */
export function GreatEmployerFilter({ surface }: { surface: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const current = parseGreatParam(searchParams.get('great'))

  function toggle(filter: GreatFilter) {
    const on = !current.includes(filter)
    const next = on ? [...current, filter] : current.filter((f) => f !== filter)
    const params = new URLSearchParams(searchParams.toString())
    if (next.length === 0) params.delete('great')
    else params.set('great', greatParam(next))
    posthog.capture('board_great_filter_toggled', { surface, filter, on, filters: next })
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  return (
    <div role="group" aria-label="Show only great employers" className={cn('flex gap-1', pending && 'cursor-wait')}>
      {GREAT_FILTERS.map((f) => {
        const on = current.includes(f)
        return (
          <button
            key={f}
            type="button"
            onClick={() => toggle(f)}
            disabled={pending}
            aria-pressed={on}
            aria-busy={pending}
            title={HINT[f]}
            className={cn(
              'rounded-md border px-2 py-1 text-sm',
              on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground',
              pending && 'cursor-wait'
            )}
          >
            {GREAT_FILTER_LABEL[f]}
          </button>
        )
      })}
    </div>
  )
}
