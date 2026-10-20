'use client'

import { useActionState, useState, useTransition } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { inviteSupporterAction, removeSupporterAction } from './actions'

export function InviteSupporterForm({ redesign = false }: { redesign?: boolean } = {}) {
  const posthog = usePostHog()
  const [state, action, pending] = useActionState(async (prev: { ok?: boolean; error?: string } | null, fd: FormData) => {
    const r = await inviteSupporterAction(prev, fd)
    if (r.ok) posthog?.capture('supporter_invite_submitted', { source: 'supporters_page' })
    return r
  }, null)
  // The redesign: labels and inputs at body size, and the page's orange action color for the one button.
  if (redesign) {
    return (
      <form action={action} className={pending ? 'cursor-wait space-y-4' : 'space-y-4'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="sup-name" className="block text-base font-semibold text-ink">Their name</label>
            <input id="sup-name" name="name" required autoComplete="off" className="h-11 w-full rounded-xl border border-border bg-white px-3.5 text-base text-ink" />
          </div>
          <div className="space-y-2">
            <label htmlFor="sup-email" className="block text-base font-semibold text-ink">Their email</label>
            <input id="sup-email" name="email" type="email" required autoComplete="off" className="h-11 w-full rounded-xl border border-border bg-white px-3.5 text-base text-ink" />
          </div>
        </div>
        <button type="submit" disabled={pending} className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95 disabled:cursor-wait disabled:opacity-70">
          {pending ? 'Sending invite…' : 'Send invite'}
        </button>
        {state?.ok && <p role="status" className="text-base text-ink">Invite sent. You can invite up to three people.</p>}
        {state?.error && <p role="alert" className="text-base text-destructive">{state.error}</p>}
      </form>
    )
  }

  return (
    <form action={action} className={pending ? 'cursor-wait space-y-3' : 'space-y-3'}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="sup-name" className="text-sm font-medium">Their name</label>
          <input id="sup-name" name="name" required autoComplete="off" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
        </div>
        <div className="space-y-1">
          <label htmlFor="sup-email" className="text-sm font-medium">Their email</label>
          <input id="sup-email" name="email" type="email" required autoComplete="off" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
        </div>
      </div>
      <button type="submit" disabled={pending} className="rounded-full bg-orange px-5 py-2.5 text-sm font-semibold text-navy hover:opacity-90 disabled:cursor-wait">
        {pending ? 'Sending invite…' : 'Send invite'}
      </button>
      {state?.ok && <p role="status" className="text-sm text-success">Invite sent. You can invite up to three people.</p>}
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}

// Removing is destructive, so it asks first and never takes focus by default.
export function RemoveSupporterButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">
        Remove
      </button>
    )
  }
  return (
    <span className="flex items-center gap-3 text-sm">
      <span>Stop sending {name} updates?</span>
      <button type="button" onClick={() => setConfirming(false)} className="font-medium underline underline-offset-4">
        Keep them
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => removeSupporterAction(id))}
        className="font-medium text-destructive underline underline-offset-4 disabled:cursor-wait"
      >
        {pending ? 'Removing…' : 'Yes, remove'}
      </button>
    </span>
  )
}
