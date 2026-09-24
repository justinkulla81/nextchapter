'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { approveActivities, discardActivities } from '@/app/support/admin/(portal)/crm/actions'
import { CrmPeekButton } from '@/components/admin/CrmPeekPanel'
import { priorityTierClass } from '@/lib/crm/labels'

export interface ReviewRow {
  id: string
  occurredAt: string
  subject: string | null
  body: string | null
  personId: string
  personName: string
  priority: 'P0' | 'P1' | 'P2' | null
}

function stamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  })
}

/** Approve/discard queue for outbound mail the sync couldn't confirm is about NextChapter. */
export function CrmNeedsReviewList({ rows }: { rows: ReviewRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function approve(ids: string[]) {
    setResult(null)
    start(async () => {
      const res = await approveActivities(ids)
      setResult(`Approved ${res.approved}.`)
      setSelected(new Set())
      router.refresh()
    })
  }

  function discard(ids: string[]) {
    setResult(null)
    start(async () => {
      const res = await discardActivities(ids)
      setResult(`Discarded ${res.discarded}.`)
      setSelected(new Set())
      router.refresh()
    })
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nothing waiting on review.
      </p>
    )
  }

  return (
    <div className={`space-y-3 ${pending ? 'cursor-progress' : ''}`}>
      {result && <p role="status" className="text-sm text-muted-foreground">{result}</p>}

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex items-center gap-3 rounded-lg border border-border bg-background/95 p-3 shadow-sm backdrop-blur">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <button
            type="button" disabled={pending} onClick={() => approve([...selected])}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? 'Working…' : `Approve ${selected.size}`}
          </button>
          <button
            type="button" disabled={pending} onClick={() => discard([...selected])}
            className="rounded-md border border-destructive/50 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
          >
            Discard {selected.size}
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-sm text-muted-foreground underline">
            Clear
          </button>
        </div>
      )}

      <label className="flex items-center gap-3 px-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          aria-label="Select all emails"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = selected.size > 0 && !allSelected }}
          onChange={() => {
            setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
            if (!allSelected) posthog.capture('crm_needs_review_select_all', { count: rows.length })
          }}
        />
        {allSelected ? `All ${rows.length} selected` : `Select all ${rows.length}`}
      </label>

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {rows.map((r) => (
          <li key={r.id} className="flex gap-3 px-3 py-2.5">
            <input
              type="checkbox" aria-label={`Select email to ${r.personName}`}
              checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="mt-1"
            />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="text-xs font-medium text-muted-foreground">You →</span>
                <CrmPeekButton id={r.personId} kind="person">{r.personName}</CrmPeekButton>
                {r.priority && (
                  <span className={`rounded px-1 text-xs font-semibold ${priorityTierClass(r.priority)}`}>{r.priority}</span>
                )}
                <span className="font-medium">{r.subject || '(no subject)'}</span>
              </p>
              {r.body && <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.body}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <time dateTime={r.occurredAt} className="text-xs tabular-nums text-muted-foreground">{stamp(r.occurredAt)}</time>
              <span className="flex gap-1.5">
                <button
                  type="button" disabled={pending} onClick={() => approve([r.id])}
                  className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button" disabled={pending} onClick={() => discard([r.id])}
                  className="rounded-md border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-60"
                >
                  Discard
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
