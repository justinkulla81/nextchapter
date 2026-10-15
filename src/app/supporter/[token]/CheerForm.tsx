'use client'

import { useActionState } from 'react'
import { sendCheerAction } from './actions'

export function CheerForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(sendCheerAction.bind(null, token), null)
  return (
    <form action={action} className={pending ? 'cursor-wait space-y-3' : 'space-y-3'}>
      <label htmlFor="cheer" className="block text-sm font-semibold">
        Send a cheer
      </label>
      <textarea
        id="cheer"
        name="message"
        maxLength={280}
        rows={3}
        required
        className="w-full rounded-md border border-input bg-background p-3 text-sm"
        placeholder="You are doing great. Proud of you."
      />
      <button type="submit" disabled={pending} className="rounded-full bg-success px-5 py-2.5 text-sm font-semibold text-white hover:bg-success-hover disabled:cursor-wait">
        {pending ? 'Sending…' : 'Send cheer'}
      </button>
      {state?.ok && <p role="status" className="text-sm text-success">Sent. They will see it next time they open NextChapter.</p>}
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
