'use client'

import { useState } from 'react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { NEED_COPY, type NeedKind } from './PartnerView'

// One tap tells the people at Close level what kind of day it is. It is your signal, never theirs:
// nobody can ask you for an update, and it clears itself at midnight.
export function TodayINeed({ initial = 'none', peopleNames }: { initial?: NeedKind; peopleNames: string }) {
  const [need, setNeed] = useState<NeedKind>(initial)
  const options: { key: Exclude<NeedKind, 'none'>; label: string }[] = [
    { key: 'listen', label: 'Listen' },
    { key: 'space', label: 'Space' },
    { key: 'distract', label: 'Distract me' },
    { key: 'cheer', label: 'Cheer me on' },
  ]
  return (
    <section aria-labelledby="need" className="space-y-3">
      <div className="space-y-1">
        <h2 id="need" className="font-display text-xl font-semibold text-ink">
          What would help today?
        </h2>
        <p className="text-sm text-muted-foreground">
          {peopleNames} will see this today, and only today. Skip it any day you like.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="What would help today">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={need === o.key}
            onClick={() => {
              const next = need === o.key ? 'none' : o.key
              setNeed(next)
              posthog.capture('supporter_need_set', { need: next })
            }}
            className={cn('rounded-full border px-5 py-2.5 text-base font-medium', need === o.key ? 'border-ink bg-ink text-white' : 'border-border text-ink hover:bg-muted')}
          >
            {o.label}
          </button>
        ))}
      </div>
      {need !== 'none' && <p className="text-sm text-muted-foreground">{NEED_COPY[need].line}</p>}
    </section>
  )
}
