'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addPersonToLists, searchPeopleForEdition } from '@/app/support/admin/(portal)/crm/mailing/actions'

/** Search the CRM and put someone on a list's default readership. */
export function ListMemberAdd({ listId }: { listId: string }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ id: string; name: string; email: string; org: string | null }[]>([])
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const search = (value: string) => {
    setQ(value)
    setMessage(null)
    if (value.trim().length < 2) return setResults([])
    start(async () => setResults(await searchPeopleForEdition(value)))
  }

  return (
    <div className={`max-w-md space-y-2 ${pending ? 'cursor-wait' : ''}`}>
      <input
        value={q} onChange={(e) => search(e.target.value)} aria-label="Search the CRM to add someone to this list"
        placeholder="Search the CRM by name, email or organization"
        className="h-8 w-full rounded border border-input bg-transparent px-2 text-sm"
      />
      {results.length > 0 && (
        <ul className="divide-y divide-border rounded border border-border text-sm">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button" disabled={pending}
                onClick={() => start(async () => {
                  const r = await addPersonToLists(p.id, [listId])
                  setMessage({ ok: r.ok, text: r.message })
                  if (r.ok) { setQ(''); setResults([]); router.refresh() }
                })}
                className="w-full px-2 py-1.5 text-left hover:bg-muted"
              >
                Add {p.name} <span className="text-xs text-muted-foreground">{p.email}{p.org ? ` · ${p.org}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && results.length === 0 && !pending && (
        <p className="text-xs text-muted-foreground">Nobody with an email address matches. Add their email on their CRM page first.</p>
      )}
      {message && <p role="status" className={`text-xs ${message.ok ? 'text-muted-foreground' : 'text-destructive'}`}>{message.text}</p>}
    </div>
  )
}
