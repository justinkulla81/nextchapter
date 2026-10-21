'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// Two adjacent buttons: the member's own state vs. nationwide. Stored in the
// URL (?market=us) so the server section re-renders from the shared cache.
export function MarketScopeToggle({ stateName, current }: { stateName: string; current: 'state' | 'us' }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, start] = useTransition()

  const choose = (scope: 'state' | 'us') => {
    if (scope === current) return
    posthog.capture('market_data_scope_selected', { scope, state: stateName, surface: 'market_reality' })
    const params = new URLSearchParams(searchParams.toString())
    if (scope === 'us') params.set('market', 'us')
    else params.delete('market')
    const qs = params.toString()
    start(() => router.push(`${pathname}${qs ? `?${qs}` : ''}#market-data`, { scroll: false }))
  }

  const pill = (on: boolean) =>
    cn(
      'inline-flex h-10 items-center rounded-full border px-5 text-sm font-medium select-none',
      on ? 'border-ink bg-ink text-white' : 'border-border text-ink hover:bg-muted',
      pending && 'cursor-wait'
    )
  return (
    <div role="group" aria-label="Market data scope" className={cn('flex gap-2', pending && 'cursor-wait')}>
      <button type="button" aria-pressed={current === 'state'} onClick={() => choose('state')} className={pill(current === 'state')}>
        {stateName}
      </button>
      <button type="button" aria-pressed={current === 'us'} onClick={() => choose('us')} className={pill(current === 'us')}>
        Nationwide
      </button>
    </div>
  )
}
