'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { sendTestBrief, type TestSendState } from './actions'

export function TestSendForm({ adminEmail }: { adminEmail: string }) {
  const [state, action] = useActionState<TestSendState, FormData>(sendTestBrief, null)
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="memberId" className="block text-sm font-medium">Member id (optional)</label>
        <input id="memberId" name="memberId" className="w-full max-w-sm rounded-md border border-border px-3 py-2 text-sm" placeholder="Leave empty to use the first senior member with an item" />
      </div>
      <SubmitButton pendingLabel="Drafting and sending…" savedLabel="Sent">Send me a test</SubmitButton>
      <p className="text-sm text-muted-foreground">
        Sends to {adminEmail} only, using a real senior member&apos;s data. It makes one model call (about a fifth of a cent), writes nothing to the member&apos;s Gmail and sends the member nothing.
      </p>
      {state ? <p role="status" className={`text-sm ${state.ok ? '' : 'text-destructive'}`}>{state.message}</p> : null}
    </form>
  )
}
