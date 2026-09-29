'use client'

import { useTransition } from 'react'
import { setContactHandled } from '@/app/support/admin/(portal)/crm/contact-messages/actions'

export function ContactHandledButton({ id, handled }: { id: string; handled: boolean }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setContactHandled(id, !handled))}
      className={`rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-wait disabled:opacity-60 ${pending ? 'cursor-wait' : ''}`}
    >
      {pending ? 'Saving…' : handled ? 'Reopen' : 'Mark handled'}
    </button>
  )
}
