'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { posthog } from '@/lib/posthog/client'
import { WAGE_FLOOR_LABEL, type WageFloor } from '@/lib/careers/pivots'

const OPTIONS: WageFloor[] = ['ANY', 'WITHIN_15', 'MATCH']

// Three choices, so adjacent buttons rather than a dropdown. The page re-renders on the
// server with the new floor; the busy cursor shows while it does.
export function WageFloorButtons({ current, socCode }: { current: WageFloor; socCode: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function choose(floor: WageFloor) {
    if (floor === current) return
    posthog.capture('pivot_wage_floor_changed', { socCode, from: current, to: floor })
    start(() => router.push(`/dashboard/pivot?floor=${floor}`))
  }

  return (
    <div role="group" aria-label="How much pay you are willing to give up" className={cn('flex flex-wrap gap-2', pending && 'cursor-wait')}>
      {OPTIONS.map((floor) => (
        <Button
          key={floor}
          type="button"
          size="sm"
          variant={floor === current ? 'default' : 'outline'}
          aria-pressed={floor === current}
          className={cn(pending && 'cursor-wait')}
          onClick={() => choose(floor)}
        >
          {WAGE_FLOOR_LABEL[floor]}
        </Button>
      ))}
    </div>
  )
}
