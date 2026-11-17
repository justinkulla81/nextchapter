'use client'

import { useState, useTransition } from 'react'
import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { setSearchExpansion } from '@/app/dashboard/market/actions'

// One opt-in: add this to my job search, or take it back out.
// `quiet` is for redesigned pages, where a list of these must not carry several orange buttons: both states are outlined,
// and "in my search" is marked with a check and navy text instead of a filled button.
// Controlled (`onChange` given): the parent holds the state, so several rows that add the same thing (two cities in
// one state) stay in step. `addLabel` / `onLabel` name what the button adds ("Add Texas"); `preview` skips the server.
export function ExpansionToggle({
  kind, value, on: initial, label, quiet = false, onChange, addLabel, onLabel, surface = 'market', preview = false,
}: {
  kind: 'remote' | 'state' | 'relocate' | 'role' | 'industry'
  value: string
  on: boolean
  label: string
  quiet?: boolean
  onChange?: (on: boolean) => void
  addLabel?: string
  onLabel?: string
  surface?: string
  preview?: boolean
}) {
  const [own, setOwn] = useState(initial)
  const on = onChange ? initial : own
  const setOn = (v: boolean) => (onChange ? onChange(v) : setOwn(v))
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      <Button
        size="sm"
        variant={on && !quiet ? 'default' : 'outline'}
        className={cn(quiet && on && 'border-ink font-semibold text-ink')}
        aria-pressed={on}
        aria-label={`${label}: ${on ? 'in your job search' : 'not in your job search'}`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = preview ? {} : await setSearchExpansion(kind, value, !on)
            if (r.error) setError(r.error)
            else {
              setError(null)
              setOn(!on)
              posthog.capture('market_expansion_toggled', { kind, value, on: !on, surface })
            }
          })
        }
      >
        {on ? (onLabel ?? (quiet ? '✓ In my job search' : 'In my job search')) : (addLabel ?? 'Add to my job search')}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  )
}
