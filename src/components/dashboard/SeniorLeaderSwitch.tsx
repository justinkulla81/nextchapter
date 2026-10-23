'use client'

import { useState, useTransition } from 'react'
import { setSeniorLeader } from '@/app/dashboard/senior-actions'
import { cn } from '@/lib/utils'

// Account and privacy: the one switch behind the senior overlay (src/lib/journey/menu.ts). Two adjacent buttons,
// because there are two choices; the heading above names the setting, so this says what is true now.
export function SeniorLeaderSwitch({ on, detected }: { on: boolean; detected: boolean }) {
  const [value, setValue] = useState(on)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const choose = (next: boolean) => {
    if (next === value) return
    setError(null)
    startTransition(async () => {
      const r = await setSeniorLeader(next)
      if (r.error) setError(r.error)
      else setValue(next)
    })
  }
  const look = (active: boolean) => cn('inline-flex h-10 items-center px-5 text-sm font-medium', active ? 'bg-ink text-white' : 'text-ink hover:bg-muted')
  return (
    <div className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <p className="max-w-xl text-base text-ink">
        {value
          ? 'On. Network, recruiters and being found come first, the job board is quieter, and points, streaks and daily application prompts are off.'
          : 'Off. Your menu follows your situation, with the job board in its usual place.'}
        {detected && !value ? ' Your title and level suggest you may want it on.' : ''}
      </p>
      <div role="group" aria-label="Senior leader" className="inline-flex overflow-hidden rounded-full border border-border">
        <button type="button" aria-pressed={value} disabled={pending} onClick={() => choose(true)} className={look(value)}>Turn on</button>
        <button type="button" aria-pressed={!value} disabled={pending} onClick={() => choose(false)} className={look(!value)}>Turn off</button>
      </div>
      {error && <p role="alert" className="text-base text-destructive">{error}</p>}
    </div>
  )
}
