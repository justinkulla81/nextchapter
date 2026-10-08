'use client'

import { useActionState } from 'react'
import { unsubscribeAction, type UnsubscribeState } from './actions'

export function UnsubscribeForm({
  token,
  email,
  lists,
}: {
  token: string
  email: string
  lists: { id: string; name: string; description: string | null; checked: boolean }[]
}) {
  const [state, action, pending] = useActionState<UnsubscribeState, FormData>(unsubscribeAction, undefined)

  if (state?.done) {
    return (
      <p role="status" className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
        Done. {email} is off {state.lists && state.lists.length ? state.lists.join(', ') : 'those lists'}. Nothing more from
        {state.lists && state.lists.length > 1 ? ' them' : ' it'} will be sent.
      </p>
    )
  }

  return (
    <form action={action} className={`mt-4 space-y-4 ${pending ? 'cursor-wait' : ''}`}>
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-muted-foreground">
        Emails to <span className="font-medium text-foreground">{email}</span>. Untick anything you&apos;d like to keep getting.
      </p>
      <fieldset className="space-y-2">
        <legend className="sr-only">Lists</legend>
        {lists.map((l) => (
          <label key={l.id} className="flex items-start gap-3 rounded-lg border border-border px-3 py-2 text-sm">
            <input type="checkbox" name="listId" value={l.id} defaultChecked={l.checked} className="mt-1" />
            <span>
              <span className="font-medium">{l.name}</span>
              {l.description && <span className="block text-xs text-muted-foreground">{l.description}</span>}
            </span>
          </label>
        ))}
      </fieldset>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit" name="scope" value="selected" disabled={pending}
          className={`rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 ${pending ? 'cursor-wait opacity-70' : ''}`}
        >
          {pending ? 'Unsubscribing…' : 'Unsubscribe'}
        </button>
        <button
          type="submit" name="scope" value="all" disabled={pending}
          className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
        >
          Unsubscribe from everything
        </button>
      </div>
    </form>
  )
}
