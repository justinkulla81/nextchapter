'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { sendTestBrief, type TestSendState } from './actions'

export function TestSendForm({ adminEmail }: { adminEmail: string }) {
  const [state, action] = useActionState<TestSendState, FormData>(sendTestBrief, null)
  return (
    <form action={action} className="max-w-2xl space-y-3">
      <p className="text-base">
        We pick a real senior member who has someone to write to, write their message, and email the result to {adminEmail}. You see exactly what a member would see. The member is not emailed, and nothing goes into their Gmail. It costs about a fifth of a cent.
      </p>
      <SubmitButton pendingLabel="Writing the message and sending…" savedLabel="Sent to you">Email me a sample</SubmitButton>
      {state ? <p role="status" className={`text-base ${state.ok ? '' : 'text-destructive'}`}>{state.ok ? 'Sent. Check your inbox.' : state.message}</p> : null}
    </form>
  )
}
