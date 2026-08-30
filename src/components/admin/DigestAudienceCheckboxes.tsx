'use client'

import { useState, useTransition } from 'react'
import type { DigestAudience } from '@prisma/client'
import { setDigestAudiences } from '@/app/support/admin/(portal)/digest/actions'
import { cn } from '@/lib/utils'

const AUDIENCE_OPTIONS: { value: DigestAudience; label: string }[] = [
  { value: 'CANDIDATE', label: 'Candidates' },
  { value: 'COACH', label: 'Coaches' },
  { value: 'RECRUITER', label: 'Recruiters' },
  { value: 'EMPLOYER', label: 'Employers' },
]

// Available on every item regardless of bucket — replaces the old
// MARKET_BRIEF-only "Queue for digest" button, which meant PERSONA_RESEARCH
// items (what the coach and candidate sends actually pull from) could never
// be queued at all. Saves on every toggle, no separate "Save" step — same
// instant-feedback shape the rest of this page's row actions already use.
export function DigestAudienceCheckboxes({ itemId, current }: { itemId: string; current: DigestAudience[] }) {
  const [selected, setSelected] = useState<Set<DigestAudience>>(new Set(current))
  const [isPending, startTransition] = useTransition()

  function toggle(value: DigestAudience) {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setSelected(next)
    startTransition(() => {
      setDigestAudiences(itemId, [...next])
    })
  }

  return (
    <div className={cn('flex flex-wrap gap-2', isPending && 'cursor-progress [&_*]:cursor-progress')}>
      {AUDIENCE_OPTIONS.map((opt) => (
        <label key={opt.value} className="flex items-center gap-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={selected.has(opt.value)}
            onChange={() => toggle(opt.value)}
            className="size-3.5"
          />
          {opt.label}
        </label>
      ))}
    </div>
  )
}
