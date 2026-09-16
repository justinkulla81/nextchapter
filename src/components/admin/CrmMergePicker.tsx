'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { searchCrmPeopleByName, mergePersonIntoPerson, type CrmPersonSearchResult } from '@/app/support/admin/(portal)/crm/actions'

/**
 * Merge-target search for a single row — a name/email search rather than a
 * full picker UI, since the common case is "I know roughly who this
 * duplicates" rather than browsing.
 *
 * When a `suggested` target is already known (an exact or nickname-variant
 * duplicate found elsewhere in the table), this IS that recommendation —
 * not a second button next to a plain "Merge…" for the same action. It
 * renders pre-populated and highlighted so acting on it is one click.
 */
export function CrmMergePicker({
  personId, personName, suggested, onMerged,
}: {
  personId: string
  personName: string
  suggested?: { id: string; fullName: string } | null
  /** Fires as soon as the merge call resolves — lets a list row remove itself immediately instead of waiting on a full-page revalidation. */
  onMerged?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CrmPersonSearchResult[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const runMerge = (targetId: string, targetName: string) => {
    if (!window.confirm(`Merge ${personName} into ${targetName}? This can't be undone.`)) return
    start(async () => {
      const res = await mergePersonIntoPerson(personId, targetId)
      setStatus(res.message)
      setOpen(false)
      onMerged?.()
      // The merge target itself may now be complete, or someone else's
      // duplicate suggestion may have just become stale — refresh rather
      // than leaving the rest of the list showing pre-merge data.
      router.refresh()
    })
  }

  if (!open) {
    return suggested ? (
      <button
        type="button"
        disabled={pending}
        onClick={() => runMerge(suggested.id, suggested.fullName)}
        className={`rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white ${pending ? 'cursor-progress opacity-60' : ''}`}
      >
        {pending ? 'Merging…' : `Merge into ${suggested.fullName}`}
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
      >
        Merge…
      </button>
    )
  }

  return (
    <div className="relative">
      <input
        type="text"
        autoFocus
        value={query}
        placeholder="Search name or email to merge into…"
        onChange={(e) => {
          const q = e.target.value
          setQuery(q)
          start(async () => setResults(await searchCrmPeopleByName(q, personId)))
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="h-7 w-56 rounded border border-input bg-background px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
      />
      {(results.length > 0 || pending) && (
        <ul className="absolute z-10 mt-1 w-72 rounded-md border border-border bg-background text-xs shadow-md">
          {pending && <li className="px-2 py-1.5 text-muted-foreground">Searching…</li>}
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); runMerge(r.id, r.fullName) }}
                className="block w-full px-2 py-1.5 text-left hover:bg-muted"
              >
                <span className="font-medium">{r.fullName}</span>
                {r.org && <span className="text-muted-foreground"> · {r.org}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {status && <p className="mt-1 text-xs text-muted-foreground">{status}</p>}
    </div>
  )
}
