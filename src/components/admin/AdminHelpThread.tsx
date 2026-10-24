'use client'

import { useActionState, useTransition } from 'react'
import Link from 'next/link'
import { replyToHelp, sendHelpToVision, setHelpResolved, type AdminHelpState } from '@/app/support/admin/(portal)/help/actions'

export function AdminHelpReplyForm({
  requestId, firstName, sendTo, inApp, resolved,
}: { requestId: string; firstName: string | null; sendTo: string | null; inApp: boolean; resolved: boolean }) {
  const [state, action, pending] = useActionState<AdminHelpState, FormData>(replyToHelp.bind(null, requestId), undefined)
  return (
    <form
      key={state?.sent ? 'sent' : 'draft'}
      action={action}
      className={`space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm ${pending ? 'cursor-wait' : ''}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor="admin-help-reply" className="text-sm font-semibold">Reply{firstName ? ` to ${firstName}` : ''}</label>
        <p className="text-xs text-muted-foreground">
          {sendTo ? <>Emailed to <span className="font-medium text-foreground">{sendTo}</span>{inApp ? ', and shown in their portal' : '. They reply by email'}</> : 'No email on file: they will only see it in the portal.'}
        </p>
      </div>
      <textarea
        id="admin-help-reply"
        name="message"
        rows={6}
        required
        defaultValue={state?.message}
        placeholder="Write your reply. Plain and direct works best."
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') e.currentTarget.form?.requestSubmit() }}
        className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
      />
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state?.sent && <p role="status" className="text-sm text-success">Sent{state.emailed ? ' and emailed.' : '. The email could not be sent; check the address.'}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="resolve" defaultChecked={!resolved} /> Mark resolved when sent
        </label>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">⌘ + Enter to send</span>
          <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-wait disabled:opacity-70">
            {pending ? 'Sending…' : 'Send reply'}
          </button>
        </div>
      </div>
    </form>
  )
}

export function AdminHelpActions({ requestId, resolved, isProblem, inVision }: { requestId: string; resolved: boolean; isProblem: boolean; inVision: boolean }) {
  const [pending, start] = useTransition()
  return (
    <div className={`flex flex-col items-stretch gap-2 text-sm ${pending ? 'cursor-wait' : ''}`}>
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
