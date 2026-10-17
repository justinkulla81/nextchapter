'use client'

import { useState, useTransition } from 'react'
import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { setSearchExpansion } from '@/app/dashboard/market/actions'

// One opt-in: add this to my job search, or take it back out.
export function ExpansionToggle({ kind, value, on: initial, label }: { kind: 'remote' | 'state' | 'relocate' | 'role' | 'industry'; value: string; on: boolean; label: string }) {
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      <Button
        size="sm"
        variant={on ? 'default' : 'outline'}
        aria-pressed={on}
        aria-label={`${label}: ${on ? 'in your job search' : 'not in your job search'}`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setSearchExpansion(kind, value, !on)
            if (r.error) setError(r.error)
            else {
              setError(null)
              setOn(!on)
              posthog.capture('market_expansion_toggled', { kind, value, on: !on })
            }
          })
        }
      >
        {on ? 'In my job search' : 'Add to my job search'}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  )
}
