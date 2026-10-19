'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'

// The one primary action on a screen: the orange action color, the most visible thing on the page. While the
// action runs it shows the busy cursor. If it is off, it says in plain words why and what to do (never a silent
// disabled button).
export function PrimaryAction({
  children,
  pending: pendingProp = false,
  pendingLabel,
  disabledReason,
  type = 'submit',
  onClick,
}: {
  children: ReactNode
  pending?: boolean
  pendingLabel?: string
  /** When set the button is off, and this line says why and what to do. */
  disabledReason?: string | null
  type?: 'submit' | 'button'
  onClick?: () => void
}) {
  // Inside a form the button knows by itself when its action is running.
  const { pending: formPending } = useFormStatus()
  const pending = pendingProp || formPending
  const off = pending || !!disabledReason
  return (
    <div className="space-y-2">
      <button
        type={type}
        onClick={onClick}
        disabled={off}
        aria-describedby={disabledReason ? 'primary-action-reason' : undefined}
        className={cn(
          'inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none',
          off && 'opacity-60 hover:brightness-100',
          pending ? 'cursor-progress' : off ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        {pending ? (pendingLabel ?? 'Saving…') : children}
      </button>
      {disabledReason && (
        <p id="primary-action-reason" className="text-sm text-muted-foreground">
          {disabledReason}
        </p>
      )}
    </div>
  )
}
