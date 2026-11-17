'use client'

import { useActionState, useState } from 'react'
import { approvePageEditAction, declinePageEditAction, type PageEditState } from '@/app/support/admin/(portal)/organizations/page-edits/actions'

// Publish (the primary action) or send back with a note saying what to change.
export function PageEditDecision({ id, orgName }: { id: string; orgName: string }) {
  const [approved, approve, approving] = useActionState<PageEditState, FormData>(approvePageEditAction.bind(null, id), undefined)
  const [declined, decline, declining] = useActionState<PageEditState, FormData>(declinePageEditAction.bind(null, id), undefined)
  const [asking, setAsking] = useState(false)
  const busy = approving || declining
  const result = approved ?? declined
  if (result?.ok) return <p role="status" className="text-sm text-success">{result.message}</p>
  return (
    <div className={busy ? 'cursor-wait space-y-2' : 'space-y-2'}>
      <div className="flex flex-wrap gap-2">
        <form action={approve}>
          <button type="submit" disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-wait disabled:opacity-70">
            {approving ? 'Publishing…' : 'Approve and publish'}
          </button>
        </form>
        {!asking && (
          <button type="button" onClick={() => setAsking(true)} className="rounded-full border border-border px-4 py-2 text-sm font-medium">
            Ask for a change
          </button>
        )}
      </div>
      {asking && (
        <form action={decline} className="space-y-2">
          <label htmlFor={`note-${id}`} className="text-sm font-medium">
            What should {orgName} change?
          </label>
          <textarea id={`note-${id}`} name="note" required maxLength={500} rows={3} className="w-full max-w-xl rounded-md border border-input bg-background p-2 text-sm" />
          <button type="submit" disabled={busy} className="rounded-full border border-border px-4 py-2 text-sm font-medium disabled:cursor-wait disabled:opacity-70">
            {declining ? 'Sending…' : 'Send it back'}
          </button>
        </form>
      )}
      {result && !result.ok && <p role="alert" className="text-sm text-destructive">{result.message}</p>}
    </div>
  )
}
