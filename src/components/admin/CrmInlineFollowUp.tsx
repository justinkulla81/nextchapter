'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setPersonFollowUp, clearPersonFollowUp } from '@/app/support/admin/(portal)/crm/actions'
import { formatDate } from '@/lib/crm/labels'

/**
 * Collapsed, it's a one-line summary — click to expand into note + optional
 * date. No date is a valid state (logCallWithFollowUp already supports it
 * from the peek panel's call log): a follow-up can be "check back on this"
 * with no specific day attached.
 */
export function CrmInlineFollowUp({
  personId, note, dueAt, awaitingDays,
}: {
  personId: string
  note: string | null
  dueAt: Date | null
  /** Days since we last spoke with no reply, or null when we aren't waiting.
   * Counted by the caller: "how long ago" is a clock read, and reading the
   * clock during render is exactly what the purity rule forbids. */
  awaitingDays?: number | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [noteValue, setNoteValue] = useState(note ?? '')
  const [dateValue, setDateValue] = useState(dueAt ? dueAt.toISOString().slice(0, 10) : '')
  const [pending, start] = useTransition()

  if (!open) {
    const hasFollowUp = Boolean(note || dueAt)
    // "No follow-up set" is the least useful thing this cell can say about
    // someone we emailed a week ago and never heard back from — that IS the
    // follow-up, and the number of days is the part that decides whether to
    // nudge today. An explicit follow-up still wins: it's a decision, where
    // this is an inference.
    const waitingDays = hasFollowUp ? null : awaitingDays ?? null

    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-left text-xs hover:underline ${hasFollowUp || waitingDays !== null ? 'text-amber-700' : 'text-muted-foreground'}`}
      >
        {hasFollowUp
          ? `Follow up${dueAt ? ` ${formatDate(dueAt)}` : ''}${note ? `: ${note}` : ''}`
          : waitingDays !== null
            ? `Waiting for a reply · ${waitingDays === 0 ? 'today' : `${waitingDays}d`}`
            : 'No follow-up set'}
      </button>
    )
  }

  return (
    <div className="space-y-1 rounded-md border border-border bg-background p-2 text-xs shadow-sm">
      <textarea
        value={noteValue}
        onChange={(e) => setNoteValue(e.target.value)}
        placeholder="What to follow up on"
        rows={2}
        disabled={pending}
        className="w-56 rounded border border-input bg-transparent p-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
      />
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={dateValue}
          onChange={(e) => setDateValue(e.target.value)}
          disabled={pending}
          className="h-7 rounded border border-input bg-transparent px-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { await setPersonFollowUp(personId, noteValue, dateValue); setOpen(false); router.refresh() })}
          className={`rounded-md bg-brand px-2 py-1 text-xs font-medium text-white ${pending ? 'cursor-progress opacity-60' : ''}`}
        >
          Save
        </button>
        {(note || dueAt) && (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => { await clearPersonFollowUp(personId); setNoteValue(''); setDateValue(''); setOpen(false); router.refresh() })}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            Clear
          </button>
        )}
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground underline">
          Cancel
        </button>
      </div>
    </div>
  )
}
