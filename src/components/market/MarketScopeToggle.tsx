'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'
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

  return (
    <div role="group" aria-label="Market data scope" className={cn('flex gap-2', pending && 'cursor-wait')}>
      <Button size="sm" variant={current === 'state' ? 'default' : 'outline'} aria-pressed={current === 'state'} onClick={() => choose('state')} className={cn(pending && 'cursor-wait')}>
        {stateName}
      </Button>
      <Button size="sm" variant={current === 'us' ? 'default' : 'outline'} aria-pressed={current === 'us'} onClick={() => choose('us')} className={cn(pending && 'cursor-wait')}>
        Nationwide
      </Button>
    </div>
  )
}
