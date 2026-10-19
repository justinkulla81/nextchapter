'use client'

import { useState } from 'react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { LEVELS, RELATIONSHIPS, type Relationship, type ShareLevel } from './levels'

// Three questions, in order: who are they, what can they see, how do we reach them.
// Choosing "Partner" suggests Close; the member can change it.
export function InviteForm() {
  const [relationship, setRelationship] = useState<Relationship>('partner')
  const [level, setLevel] = useState<ShareLevel>('close')
  const choose = (r: Relationship) => {
    setRelationship(r)
    setLevel(RELATIONSHIPS.find((x) => x.key === r)!.defaultLevel)
  }
  const chip = (on: boolean) => cn('rounded-full border px-4 py-2 text-sm font-medium', on ? 'border-ink bg-ink text-white' : 'border-border text-ink hover:bg-muted')
  return (
    <form
      className="space-y-6 rounded-2xl border border-border p-6"
      onSubmit={(e) => {
        e.preventDefault()
        posthog.capture('supporter_invite_submitted', { relationship, level })
      }}
    >
      <fieldset className="space-y-2">
        <legend className="text-base font-semibold text-ink">Who do you want in your corner?</legend>
        <div className="flex flex-wrap gap-2">
          {RELATIONSHIPS.map((r) => (
            <button key={r.key} type="button" aria-pressed={relationship === r.key} onClick={() => choose(r.key)} className={chip(relationship === r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-base font-semibold text-ink">What can they see?</legend>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button key={l.key} type="button" aria-pressed={level === l.key} onClick={() => setLevel(l.key)} className={chip(level === l.key)}>
              {l.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{LEVELS.find((l) => l.key === level)!.sees}</p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium text-ink">
          Their name
          <input className="h-11 w-full rounded-xl border border-border px-3.5 text-base font-normal" autoComplete="off" />
        </label>
        <label className="space-y-1.5 text-sm font-medium text-ink">
          Their email
          <input type="email" className="h-11 w-full rounded-xl border border-border px-3.5 text-base font-normal" autoComplete="off" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="h-11 rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95">
          Send invite
        </button>
        <p className="text-sm text-muted-foreground">They get an email and a private page. No account needed.</p>
      </div>
    </form>
  )
}
