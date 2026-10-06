'use client'

import { useActionState, useTransition } from 'react'
import Link from 'next/link'
import { replyToHelp, sendHelpToVision, setHelpResolved, type AdminHelpState } from '@/app/support/admin/(portal)/help/actions'

export function AdminHelpReplyForm({ requestId, firstName, resolved }: { requestId: string; firstName: string | null; resolved: boolean }) {
  const [state, action, pending] = useActionState<AdminHelpState, FormData>(replyToHelp.bind(null, requestId), undefined)
  return (
    <form key={state?.sent ? 'sent' : 'draft'} action={action} className={`space-y-2 rounded-lg border border-border p-4 ${pending ? 'cursor-wait' : ''}`}>
      <label htmlFor="admin-help-reply" className="text-sm font-semibold">Reply{firstName ? ` to ${firstName}` : ''}</label>
      <textarea id="admin-help-reply" name="message" rows={5} required defaultValue={state?.message} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="resolve" defaultChecked={!resolved} /> Mark resolved when sent
      </label>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state?.sent && <p role="status" className="text-sm text-success">Sent{state.emailed ? ' and emailed.' : '. The email could not be sent; they’ll see it in the portal.'}</p>}
      <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-wait disabled:opacity-70">
        {pending ? 'Sending…' : 'Send reply'}
      </button>
    </form>
  )
}

export function AdminHelpActions({ requestId, resolved, isProblem, inVision }: { requestId: string; resolved: boolean; isProblem: boolean; inVision: boolean }) {
  const [pending, start] = useTransition()
  return (
    <div className={`flex flex-wrap items-center gap-3 text-sm ${pending ? 'cursor-wait' : ''}`}>
      <button type="button" disabled={pending} onClick={() => start(() => setHelpResolved(requestId, !resolved))} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted disabled:opacity-60">
        {resolved ? 'Reopen' : 'Mark resolved without replying'}
      </button>
      {isProblem && (inVision ? (
        <Link href="/support/admin/vision/feedback" className="text-muted-foreground underline">In Vision → Feedback</Link>
      ) : (
        <button type="button" disabled={pending} onClick={() => start(() => sendHelpToVision(requestId))} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted disabled:opacity-60">
          Send to Vision → Feedback
        </button>
      ))}
    </div>
  )
}
