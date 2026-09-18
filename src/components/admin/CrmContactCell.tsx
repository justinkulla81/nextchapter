'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { logContact } from '@/app/support/admin/(portal)/crm/actions'

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
  personId, name, lastLabel, touchCount, awaitingReply,
}: {
  personId: string
  name: string
  lastLabel: string
  touchCount: number
  awaitingReply?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  // Local date, not UTC: after 8pm Eastern, toISOString() is already tomorrow.
  const today = new Date().toLocaleDateString('en-CA')
  const [channel, setChannel] = useState<string>('EMAIL')
  const [date, setDate] = useState(today)

  // Not a <form>: this cell renders inside the bulk-edit form, and a form in
  // a form is invalid HTML — the browser dropped this one, so "Log" submitted
  // the bulk bar and nothing was ever recorded.
  function log() {
    start(async () => {
      const fd = new FormData()
      fd.set('channel', channel)
      fd.set('occurredAt', date)
      await logContact(personId, fd)
      setOpen(false)
      router.refresh()
    })
  }

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
        {awaitingReply && (
          <span className="ml-1.5 rounded-full bg-orange/15 px-1.5 py-0.5 text-xs font-medium text-orange">
            Waiting on them
          </span>
        )}
      </button>
    )
  }

  return (
    <div role="group" aria-label={`Log contact with ${name}`} className="min-w-56 space-y-1.5 rounded-md border border-border bg-background p-2">
      <div className="flex flex-wrap gap-1">
        {CHANNELS.map((c) => (
          <button
            key={c.key} type="button" aria-pressed={channel === c.key} onClick={() => setChannel(c.key)}
            className={`rounded-full border px-2 py-0.5 text-xs ${channel === c.key ? 'border-brand bg-brand/10 font-medium text-brand' : 'border-border hover:bg-muted'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor={`when-${personId}`}>When</label>
        <input
          id={`when-${personId}`} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)}
          className="h-7 rounded border border-input bg-transparent px-1.5 text-xs"
        />
        <button
          type="button" onClick={log} disabled={pending}
          className={`rounded bg-brand px-2 py-1 text-xs font-medium text-white ${pending ? 'cursor-progress opacity-60' : ''}`}
        >
          {pending ? 'Saving…' : 'Log'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground underline">
          Cancel
        </button>
      </div>
    </div>
  )
}
