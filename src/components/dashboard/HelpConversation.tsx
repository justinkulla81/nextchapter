'use client'

import { useActionState, useEffect, useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import { markHelpRequestRead, replyToHelpRequest, type HelpFormState } from '@/app/dashboard/help/actions'

interface ConversationView {
  id: string
  subject: string
  kindLabel: string
  started: string
  resolved: boolean
  replyWaiting: boolean
  messages: { id: string; body: string; fromAdmin: boolean; when: string }[]
}

/** One help conversation on /dashboard/help: collapsed to its subject, opens to the thread and a reply box. */
export function HelpConversation({ request, defaultOpen }: { request: ConversationView; defaultOpen: boolean }) {
  const posthog = usePostHog()
  const [open, setOpen] = useState(defaultOpen)
  const [state, action, pending] = useActionState<HelpFormState, FormData>(replyToHelpRequest.bind(null, request.id), undefined)

  // Opening a conversation with a reply in it clears the badge.
  useEffect(() => {
    if (open && request.replyWaiting) void markHelpRequestRead(request.id)
  }, [open, request.id, request.replyWaiting])

  const pill = request.replyWaiting
    ? 'bg-orange/15 text-navy'
    : request.resolved ? 'bg-success/10 text-success' : 'bg-brand/10 text-brand'
  const status = request.replyWaiting ? 'Reply waiting' : request.resolved ? 'Resolved' : 'Open'

  return (
    <div className="rounded-xl border border-border bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); if (!open) posthog?.capture('help_conversation_opened', { requestId: request.id, replyWaiting: request.replyWaiting }) }}
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-foreground">{request.subject}</span>
          <span className="text-xs text-muted-foreground">{request.kindLabel} · {request.started}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${pill}`}>{status}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border p-4">
          <ol className="space-y-3">
            {request.messages.map((m) => (
              <li key={m.id} className={`rounded-lg px-3 py-2 text-sm ${m.fromAdmin ? 'bg-brand/5' : 'bg-muted/60'}`}>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">{m.fromAdmin ? 'NextChapter team' : 'You'} · {m.when}</p>
                <p className="whitespace-pre-wrap text-foreground">{m.body}</p>
              </li>
            ))}
          </ol>

          {state?.sent ? (
            <p role="status" className="text-sm font-medium text-success">Sent. We’ll reply here and by email.</p>
          ) : (
            <form action={action} className={pending ? 'cursor-wait' : undefined}>
              <label htmlFor={`reply-${request.id}`} className="text-sm font-semibold text-navy">
                {request.resolved ? 'Still need help? Reply to reopen this' : 'Reply'}
              </label>
              <textarea
                id={`reply-${request.id}`}
                name="message"
                rows={3}
                required
                defaultValue={state?.message}
                className="mt-1 w-full resize-y rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
              />
              {state?.error && <p role="alert" className="mt-1 text-sm font-medium text-error">{state.error}</p>}
              <button
                type="submit"
                disabled={pending}
                className="mt-2 inline-flex items-center rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success-hover disabled:cursor-wait disabled:opacity-70"
              >
                {pending ? 'Sending…' : 'Send reply'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
