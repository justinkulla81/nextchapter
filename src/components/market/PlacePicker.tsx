'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { compareHref, MAX_PLACES, type Lens } from '@/lib/workforce/metro-compare'

// A searchable list of the 387 metro areas (more than five options, so not buttons). Choosing one adds it to the
// comparison by changing the address, so the server does the measuring and the page can be shared.
export function PlacePicker({ metros, chosen, lens }: { metros: { cbsa: string; name: string }[]; chosen: string[]; lens: Lens }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const listId = useId()
  const full = chosen.length >= MAX_PLACES
  const needle = q.toLowerCase().trim()
  const matches = needle.length < 2 ? [] : metros.filter((m) => !chosen.includes(m.cbsa) && m.name.toLowerCase().includes(needle)).slice(0, 8)

  function add(m: { cbsa: string; name: string }) {
    posthog.capture('compare_place_added', { cbsa: m.cbsa, name: m.name, placesNow: chosen.length + 1, lens })
    setQ('')
    router.push(compareHref([...chosen, m.cbsa], lens))
  }

  if (full) {
    return <p className="text-sm text-muted-foreground">You are comparing {MAX_PLACES} places, the most that fit side by side. Remove one to add another.</p>
  }
  return (
    <div className="space-y-2">
      <label htmlFor={listId} className="block text-sm font-medium text-ink">
        {chosen.length === 0 ? 'Where are you thinking of moving?' : 'Add another place'}
      </label>
      <input
        id={listId}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type a city, like Raleigh or Denver"
        autoComplete="off"
        className="h-11 w-full max-w-md rounded-full border border-border bg-background px-5 text-base text-ink placeholder:text-muted-foreground"
      />
      {needle.length >= 2 && matches.length === 0 && (
        <p className="text-sm text-muted-foreground">No metro area matches &ldquo;{q}&rdquo;. Try the larger city nearby.</p>
      )}
      {matches.length > 0 && (
        <ul className="max-w-md divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
          {matches.map((m) => (
            <li key={m.cbsa}>
              <button type="button" onClick={() => add(m)} className="w-full cursor-pointer px-5 py-3 text-left text-base text-ink hover:bg-muted">
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
