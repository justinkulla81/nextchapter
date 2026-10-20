'use client'

import { useState, useTransition } from 'react'
import type { SuppressedSenderReason } from '@prisma/client'
import { cn } from '@/lib/utils'
import { flagNotJobRelated } from '@/app/dashboard/network/actions'
import { SUPPRESSED_SENDER_REASONS } from '@/lib/network/suppressed-sender-reasons'

// "Not part of my job search" for one sender: opens to the four reasons as
// adjacent buttons, and picking one blocks the sender for good (see
// flagNotJobRelated). Calls onFlagged right away so the row can leave the list
// without waiting on the server; on failure the message stays in place and the
// row comes back via onFailed.
export function NotJobRelatedPicker({
  sourceId,
  sourceKind,
  senderLabel,
  onFlagged,
  onFailed,
  redesign = false,
}: {
  sourceId: string
  sourceKind: 'meeting' | 'email'
  senderLabel: string
  onFlagged?: () => void
  onFailed?: () => void
  // The redesigned look: the same four reasons, at the size and spacing of the other redesigned buttons.
  redesign?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function flag(reason: SuppressedSenderReason) {
    setError(null)
    onFlagged?.()
    startTransition(async () => {
      try {
        const result = await flagNotJobRelated(sourceId, sourceKind, reason)
        if (result.error) {
          setError(result.error)
          onFailed?.()
        }
      } catch {
        setError("We couldn't save that just now. Check your connection and try again.")
        onFailed?.()
      }
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={redesign ? 'inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-muted-foreground hover:bg-muted' : 'h-7 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted'}
        aria-label={`${senderLabel} isn't part of my job search`}
        title="Family, school, spam or not work — stop showing this sender"
      >
        {redesign ? 'Not part of my search' : 'Not job-related'}
      </button>
    )
  }

  return (
    <div className={cn('space-y-1', pending && 'cursor-wait')}>
      <p className={redesign ? 'text-sm text-ink' : 'text-xs text-muted-foreground'}>What is {senderLabel}?</p>
      <div className={redesign ? 'flex flex-wrap gap-2' : 'flex flex-wrap gap-1'} role="group" aria-label={`Why ${senderLabel} isn't part of your job search`}>
        {SUPPRESSED_SENDER_REASONS.map((o) => (
          <button
            key={o.reason}
            type="button"
            disabled={pending}
            onClick={() => flag(o.reason)}
            title={o.hint}
            className={cn(
              redesign ? 'h-10 rounded-full border border-border px-4 text-sm font-medium text-ink hover:bg-muted' : 'h-7 rounded-md border border-input px-2 text-xs font-medium text-foreground hover:bg-muted',
              pending && 'cursor-wait opacity-60'
            )}
          >
            {o.label}
          </button>
        ))}
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
          className={redesign ? 'h-10 rounded-full px-4 text-sm font-medium text-muted-foreground hover:bg-muted' : 'h-7 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted'}
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className={redesign ? 'text-sm text-destructive' : 'text-xs text-destructive'}>
          {error}
        </p>
      )}
    </div>
  )
}
