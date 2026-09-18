'use client'

import { useState, useTransition } from 'react'
import { setPersonEmail } from '@/app/support/admin/(portal)/crm/actions'
import { CrmPeekButton } from '@/components/admin/CrmPeekPanel'

/**
 * "No email" plus a field, or a plain click-to-edit link when there is one.
 *
 * Deliberately NOT a <form>. This renders inside a table that is itself
 * wrapped in the bulk-edit form, and a form inside a form is invalid HTML —
 * the browser drops the inner one, which silently handed this button to the
 * bulk bar and meant clicking it did nothing at all. A button with an
 * onClick has no such problem.
 *
 * Saving the address and searching Gmail for it are two separate calls, in
 * that order. Writing one column is instant; searching a mailbox is a round
 * trip per message and used to make adding an address as slow, and as
 * failure-prone, as the search. Now the address lands immediately and the
 * search reports in afterwards — or doesn't, without taking the save with it.
 */
export function CrmEmailBackfillPrompt({ personId, email }: { personId: string; email: string | null }) {
  const [pending, start] = useTransition()
  const [value, setValue] = useState(email ?? '')
  const [savedEmail, setSavedEmail] = useState(email)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateOf, setDuplicateOf] = useState<{ id: string; name: string } | null>(null)
  const [note, setNote] = useState<string | null>(null)

  async function checkMail(address: string) {
    setNote('checking mail…')
    try {
      const res = await fetch('/api/admin/crm/check-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, email: address }),
      })
      const data = await res.json()
      const olderLabel = data.older
        ? `nothing since Jun 1 · ${data.older.count >= 100 ? '100+' : data.older.count} older${
            data.older.newestAt
              ? `, last ${new Date(data.older.newestAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
              : ''
          }`
        : null
      const base = !data.ok ? (data.message ?? 'could not check mail')
        : data.found > 0 ? `${data.found} email${data.found === 1 ? '' : 's'} logged`
        : olderLabel ?? 'no emails found'
      setNote(data.failed > 0 ? `${base} · ${data.failed} couldn’t be read` : base)
    } catch {
      setNote('could not check mail')
    }
  }

  function save() {
    const address = value.trim()
    if (!address) return
    setError(null)
    setDuplicateOf(null)
    setNote(null)
    start(async () => {
      const res = await setPersonEmail(personId, address)
      if (!res.ok) { setError(res.message); setDuplicateOf(res.duplicateOf ?? null); return }
      setSavedEmail(address)
      setEditing(false)
      void checkMail(address)
    })
  }

  if (savedEmail && !editing) {
    return (
      <span className="inline-flex flex-nowrap items-center gap-1.5">
        <a href={`mailto:${savedEmail}`} className="text-muted-foreground underline underline-offset-2">{savedEmail}</a>
        <button
          type="button"
          onClick={() => { setNote(null); setEditing(true) }}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Edit
        </button>
        {note && <span className="whitespace-nowrap text-xs text-muted-foreground">{note}</span>}
      </span>
    )
  }

  return (
    <span className="inline-flex flex-nowrap items-center gap-1.5">
      {!savedEmail && <span className="whitespace-nowrap text-xs font-medium text-amber-700">No email</span>}
      <input
        type="email"
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
        placeholder="their@email.com"
        aria-label="Their email address"
        className={`h-6 w-36 rounded border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className={`h-6 shrink-0 whitespace-nowrap rounded border border-border px-1.5 text-xs hover:bg-muted ${pending ? 'cursor-progress opacity-60' : ''}`}
      >
        {pending ? 'Saving…' : savedEmail ? 'Save' : 'Add Email'}
      </button>
      {savedEmail && (
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted-foreground underline">
          Cancel
        </button>
      )}
      {error && (
        <span role="alert" className="whitespace-nowrap text-xs text-destructive">
          {duplicateOf ? (
            <>
              Already on{' '}
              <CrmPeekButton id={duplicateOf.id} kind="person" className="font-medium underline">
                {duplicateOf.name}
              </CrmPeekButton>
              ’s record
            </>
          ) : error}
        </span>
      )}
    </span>
  )
}
