'use client'

import { useState, useTransition } from 'react'
import { logContact, togglePersonFlag } from '@/app/support/admin/(portal)/crm/actions'

const CHANNELS = [
  { key: 'EMAIL', label: 'Email' },
  { key: 'LINKEDIN', label: 'LinkedIn' },
  { key: 'CALL', label: 'Call' },
  { key: 'MEETING', label: 'Meeting' },
  { key: 'TEXT', label: 'Text' },
  { key: 'OTHER', label: 'Other' },
] as const

/**
 * "Contacted" as an action rather than a readout.
 *
 * It used to display "Last contacted" passively, which meant correcting it
 * required opening a record page — so it stayed wrong. Asking HOW matters
 * because LinkedIn can never log itself; asking WHEN matters because people
 * log things days after they happen, and defaulting to today would quietly
 * make every date a lie.
 */
export function CrmContactCell({
  personId, name, lastLabel, touchCount,
}: {
  personId: string
  name: string
  lastLabel: string
  touchCount: number
}) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const today = new Date().toISOString().slice(0, 10)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left hover:underline focus-visible:ring-2 focus-visible:ring-brand"
        aria-label={`Log contact with ${name}`}
      >
        <span className={lastLabel === 'Never' ? 'text-muted-foreground' : ''}>{lastLabel}</span>
        {touchCount > 0 && <span className="ml-1 text-xs text-muted-foreground">({touchCount})</span>}
      </button>
    )
  }

  return (
    <form
      action={(fd) => start(async () => { await logContact(personId, fd); setOpen(false) })}
      className="min-w-56 space-y-1.5 rounded-md border border-border bg-background p-2"
    >
      <fieldset className="flex flex-wrap gap-1">
        <legend className="sr-only">How you contacted {name}</legend>
        {CHANNELS.map((c, i) => (
          <label key={c.key} className="cursor-pointer">
            <input type="radio" name="channel" value={c.key} defaultChecked={i === 0} className="peer sr-only" />
            <span className="block rounded-full border border-border px-2 py-0.5 text-xs peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:font-medium peer-checked:text-brand">
              {c.label}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor={`when-${personId}`}>When</label>
        <input
          id={`when-${personId}`} type="date" name="occurredAt" defaultValue={today} max={today}
          className="h-7 rounded border border-input bg-transparent px-1.5 text-xs"
        />
        <button
          type="submit" disabled={pending}
          className={`rounded bg-brand px-2 py-1 text-xs font-medium text-white ${pending ? 'cursor-progress opacity-60' : ''}`}
        >
          {pending ? 'Saving…' : 'Log'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground underline">
          Cancel
        </button>
      </div>
    </form>
  )
}

/** The manual pin. A star, because that is what a star means everywhere else. */
export function CrmFlagToggle({ personId, flagged, name }: { personId: string; flagged: boolean; name: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={flagged}
      aria-label={flagged ? `Unpin ${name}` : `Pin ${name} to the top`}
      title={flagged ? 'Pinned to the top of every list' : 'Pin to the top'}
      onClick={() => start(() => { void togglePersonFlag(personId, !flagged) })}
      className={`text-base leading-none ${pending ? 'cursor-progress opacity-60' : ''} ${flagged ? 'text-orange' : 'text-muted-foreground/30 hover:text-muted-foreground'}`}
    >
      {flagged ? '★' : '☆'}
    </button>
  )
}
