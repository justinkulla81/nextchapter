'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setPersonFollowUp, clearPersonFollowUp, markPersonPassed, markPersonKeepInTouch } from '@/app/support/admin/(portal)/crm/actions'
import { formatDate } from '@/lib/crm/labels'

type Status = 'follow-up' | 'keep-in-touch' | 'not-interested' | 'none'

/**
 * A deal-status field: where this relationship stands, plus the date of the
 * next step when there is one.
 *
 * Collapsed it is a status pill (and the follow-up date beside it). Open, the
 * status is chosen from adjacent buttons: Keep in touch and Not interested
 * apply at once — there is nothing else to say about them — while Follow up
 * asks for the date and what to do. "Waiting for a reply" is never chosen:
 * it's inferred from who spoke last, so it shows only while no explicit
 * status has been set, and setting one takes its place.
 */
export function CrmInlineFollowUp({
  personId, note, dueAt, awaitingDays, passed, keepInTouch,
}: {
  personId: string
  note: string | null
  dueAt: Date | null
  /** Days since we last spoke with no reply, or null when we aren't waiting.
   * Counted by the caller: "how long ago" is a clock read, and reading the
   * clock during render is exactly what the purity rule forbids. */
  awaitingDays?: number | null
  /** Manually declared "not interested" — see CrmPerson.passedAt. */
  passed?: boolean
  /** Replied, nothing to chase, on the quarterly newsletter — see CrmPerson.keepInTouchAt. */
  keepInTouch?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const hasFollowUp = Boolean(note || dueAt)
  const current: Status = hasFollowUp ? 'follow-up' : keepInTouch ? 'keep-in-touch' : passed ? 'not-interested' : 'none'
  const [choosing, setChoosing] = useState<Status>(current)
  const [noteValue, setNoteValue] = useState(note ?? '')
  const [dateValue, setDateValue] = useState(dueAt ? dueAt.toISOString().slice(0, 10) : '')
  const [pending, start] = useTransition()

  const waitingDays = current === 'none' ? awaitingDays ?? null : null

  function run(action: () => Promise<unknown>) {
    start(async () => { await action(); setOpen(false); router.refresh() })
  }

  if (!open) {
    const pill =
      current === 'follow-up' ? { label: 'Follow up', tone: 'bg-amber-100 text-amber-800' }
      : current === 'keep-in-touch' ? { label: 'Keep in touch', tone: 'bg-brand/15 text-brand' }
      : current === 'not-interested' ? { label: 'Not interested', tone: 'bg-muted text-muted-foreground' }
      : waitingDays !== null ? { label: `Waiting · ${waitingDays === 0 ? 'today' : `${waitingDays}d`}`, tone: 'bg-orange/15 text-orange' }
      : { label: 'Set status', tone: 'border border-dashed border-border text-muted-foreground' }

    return (
      <button
        type="button"
        onClick={() => { setChoosing(current); setOpen(true) }}
        className="flex flex-col items-start gap-0.5 text-left"
        aria-label="Change deal status"
      >
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pill.tone}`}>{pill.label}</span>
        {current === 'follow-up' && (
          <span className="max-w-44 truncate text-xs text-muted-foreground" title={note ?? undefined}>
            {dueAt ? formatDate(dueAt) : 'No date'}{note ? ` · ${note}` : ''}
          </span>
        )}
        {current === 'keep-in-touch' && <span className="text-xs text-muted-foreground">Quarterly newsletter</span>}
      </button>
    )
  }

  const OPTIONS: { key: Status; label: string }[] = [
    { key: 'follow-up', label: 'Follow up' },
    { key: 'keep-in-touch', label: 'Keep in touch' },
    { key: 'not-interested', label: 'Not interested' },
  ]

  return (
    <div className="space-y-1.5 rounded-md border border-border bg-background p-2 text-xs shadow-sm">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Deal status">
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            disabled={pending}
            aria-pressed={choosing === o.key}
            onClick={() => {
              if (o.key === 'keep-in-touch') return run(() => markPersonKeepInTouch(personId))
              if (o.key === 'not-interested') return run(() => markPersonPassed(personId))
              setChoosing('follow-up')
            }}
            className={`rounded-md border px-2 py-1 text-xs ${choosing === o.key ? 'border-brand bg-brand/10 font-medium text-brand' : 'border-border hover:bg-muted'}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {choosing === 'follow-up' && (
        <>
          <textarea
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            placeholder="Next step"
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
              aria-label="Follow-up date"
              className="h-7 rounded border border-input bg-transparent px-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setPersonFollowUp(personId, noteValue, dateValue))}
              className={`rounded-md bg-brand px-2 py-1 text-xs font-medium text-white ${pending ? 'cursor-progress opacity-60' : ''}`}
            >
              Save
            </button>
          </div>
        </>
      )}

      <div className="flex items-center gap-3">
        {current !== 'none' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(async () => { await clearPersonFollowUp(personId); setNoteValue(''); setDateValue('') })}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            Clear status
          </button>
        )}
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground underline">
          Cancel
        </button>
      </div>
    </div>
  )
}
