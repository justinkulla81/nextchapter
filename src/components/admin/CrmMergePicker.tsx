'use client'

import { useState, useTransition } from 'react'
import { searchCrmPeopleByName, mergePersonIntoPerson, type CrmPersonSearchResult } from '@/app/support/admin/(portal)/crm/actions'

/**
 * Merge-target search for a single row — a name/email search rather than a
 * full picker UI, since the common case is "I know roughly who this
 * duplicates" rather than browsing.
 */
export function CrmMergePicker({ personId, personName }: { personId: string; personName: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CrmPersonSearchResult[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (!open) {
    return (
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
                onMouseDown={(e) => {
                  e.preventDefault()
                  if (!window.confirm(`Merge ${personName} into ${r.fullName}? This can't be undone.`)) return
                  start(async () => {
                    const res = await mergePersonIntoPerson(personId, r.id)
                    setStatus(res.message)
                    setOpen(false)
                  })
                }}
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
