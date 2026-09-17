'use client'

import { useState, useTransition } from 'react'
import { setFeedbackCandidate } from '@/app/support/admin/(portal)/vision/actions'

// A picker rather than a dropdown of every account: the candidate list grows
// without bound, and a 4,000-option <select> is not a control. Filters the
// preloaded names client-side, then saves on pick — same save-on-change
// contract as the other inline vision edits.
export function VisionFeedbackCandidate({
  feedbackId, candidates, value,
}: {
  feedbackId: string
  candidates: { id: string; name: string; email: string | null }[]
  value: { id: string; name: string } | null
}) {
  const [query, setQuery] = useState('')
  const [pending, start] = useTransition()

  const q = query.trim().toLowerCase()
  const matches = q
    ? candidates.filter((c) => c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q)).slice(0, 8)
    : []

  const save = (candidateId: string) => {
    setQuery('')
    start(() => { void setFeedbackCandidate(feedbackId, candidateId) })
  }

  if (value) {
    return (
      <span className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Candidate:</span>
        <a href={`/support/admin/candidates/${value.id}`} className="font-medium underline">{value.name}</a>
        <button
          type="button" disabled={pending} onClick={() => save('')}
          className={`text-muted-foreground underline underline-offset-4 hover:text-foreground ${pending ? 'cursor-progress opacity-60' : ''}`}
        >
          Detach
        </button>
      </span>
    )
  }

  return (
    <span className="relative inline-block">
      <input
        type="search"
        value={query}
        disabled={pending}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Attach a candidate…"
        aria-label="Attach a candidate"
        className={`h-8 w-56 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
      />
      {matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-72 overflow-hidden rounded-md border border-border bg-background shadow-md">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => save(c.id)}
                className="block w-full px-2 py-1.5 text-left text-xs hover:bg-muted"
              >
                <span className="font-medium">{c.name}</span>
                {c.email && <span className="ml-1 text-muted-foreground">{c.email}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  )
}
