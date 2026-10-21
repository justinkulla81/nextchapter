'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteContact, muteContact, restoreContact, unmuteContact } from '@/app/dashboard/network/actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const QUIET = 'inline-flex h-10 items-center rounded-full px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-ink'

// Mute and Remove on a contact row. Mute is reversible on the spot, so it just does it and says what happened.
// Remove asks first, says what happens to the person, and never takes focus by default (design-principles.md).
// The person is only hidden: Undo here or Restore on Removed contacts brings them back.
export function ContactRowActions({ contactId, name, hasEmail, muted: initiallyMuted }: { contactId: string; name: string; hasEmail: boolean; muted: boolean }) {
  const router = useRouter()
  const [muted, setMuted] = useState(initiallyMuted)
  const [confirming, setConfirming] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function toggleMute() {
    setError(null)
    const next = !muted
    start(async () => {
      posthog.capture(next ? 'contact_muted' : 'contact_unmuted', { contactId, source: 'contacts_list' })
      const result = await (next ? muteContact(contactId) : unmuteContact(contactId))
      if (result.error) setError(result.error)
      else {
        setMuted(next)
        router.refresh()
      }
    })
  }

  function remove() {
    setError(null)
    start(async () => {
      posthog.capture('contact_removed', { contactId, source: 'contacts_list' })
      await deleteContact(contactId)
      setRemoved(true)
      setConfirming(false)
      router.refresh()
    })
  }

  function undo() {
    start(async () => {
      posthog.capture('contact_restored', { contactId, source: 'contacts_list_undo' })
      await restoreContact(contactId)
      setRemoved(false)
      router.refresh()
    })
  }

  if (removed) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        Removed {name}.
        <button type="button" onClick={undo} disabled={pending} className="font-medium text-brand underline underline-offset-4 disabled:cursor-wait">
          Undo
        </button>
      </p>
    )
  }

  if (confirming) {
    return (
      <div role="alertdialog" aria-label={`Remove ${name}?`} className={cn('flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
        <span className="text-sm text-ink">Remove {name}? They are hidden, not deleted.</span>
        <button type="button" onClick={() => setConfirming(false)} className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-medium text-ink hover:bg-muted">
          Keep them
        </button>
        <button type="button" disabled={pending} onClick={remove} className="inline-flex h-10 items-center rounded-full border border-destructive px-4 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:cursor-wait disabled:opacity-70">
          {pending ? 'Removing…' : 'Yes, remove'}
        </button>
      </div>
    )
  }

  return (
    <>
      {hasEmail && (
        <button
          type="button"
          onClick={toggleMute}
          disabled={pending}
          aria-pressed={muted}
          title={muted ? `Unmute ${name}: their emails and meetings show up in your follow-ups again.` : `Mute ${name}: stop follow-ups, emails and meetings from them. They stay on your list.`}
          className={cn(QUIET, pending && 'cursor-wait')}
        >
          {muted ? 'Muted. Unmute' : 'Mute'}
        </button>
      )}
      <button type="button" onClick={() => setConfirming(true)} title={`Remove ${name} from your list. They are hidden, and you can bring them back from Removed contacts.`} className={QUIET}>
        Remove
      </button>
      {error && (
        <span role="alert" className="basis-full text-sm text-destructive">
          {error}
        </span>
      )}
    </>
  )
}
