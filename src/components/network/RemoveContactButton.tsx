'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteContact } from '@/app/dashboard/network/actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// Removing a contact asks first, says what happens, and never takes focus by default (design-principles.md).
// The person is only hidden, so the Removed contacts page can bring them back.
export function RemoveContactButton({ contactId, name }: { contactId: string; name: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-ink">
        Remove {name} from my list
      </button>
    )
  }
  return (
    <div role="alertdialog" aria-label={`Remove ${name}?`} className={cn('space-y-3', pending && 'cursor-wait')}>
      <p className="text-base text-ink">Remove {name} from your list? They are hidden, not deleted, and you can bring them back from Removed contacts.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setConfirming(false)} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted">
          Keep them
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              posthog.capture('contact_removed', { contactId, source: 'contact_detail' })
              await deleteContact(contactId)
              router.push('/dashboard/network/contacts')
            })
          }
          className="inline-flex h-10 items-center rounded-full border border-destructive px-5 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? 'Removing…' : 'Yes, remove'}
        </button>
      </div>
    </div>
  )
}
