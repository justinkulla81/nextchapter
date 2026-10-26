'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { addConferenceAction, type AddState } from '@/app/dashboard/conferences/actions'
import { posthog } from '@/lib/posthog/client'

const btn = 'inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95 disabled:cursor-wait disabled:opacity-70'
const field = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-ink'

function Submit() {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className={btn} style={pending ? { cursor: 'wait' } : undefined}>{pending ? 'Adding it…' : 'Add conference'}</button>
}

/** Paste a link, press one button, land on the conference. Nothing to review first: it can be edited afterwards. */
export function QuickAdd({ initialLink = '' }: { initialLink?: string }) {
  const [state, run] = useActionState<AddState, FormData>(
    async (prev, fd) => { posthog.capture('conference_quick_add_submitted', { source: initialLink ? 'share' : 'paste' }); return addConferenceAction(prev, fd) },
    { error: null, url: initialLink },
  )
  return (
    <form action={run} className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 space-y-1.5">
          <span className="text-sm font-medium text-ink">Paste a conference link</span>
          <input name="link" type="text" inputMode="url" defaultValue={state.url} placeholder="https://" className={field} autoComplete="off" required />
        </label>
        <Submit />
      </div>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </form>
  )
}
