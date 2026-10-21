'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// The submit button for a redesigned form: the orange primary (or a quiet secondary), a busy cursor and a
// "working" label while the action runs, and one analytics event when it is pressed. Place it inside the <form>.
export function ActionSubmit({ children, pendingLabel, variant = 'primary', event, props }: { children: ReactNode; pendingLabel?: string; variant?: 'primary' | 'secondary'; event?: string; props?: Record<string, unknown> }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={event ? () => posthog.capture(event, props) : undefined}
      className={cn(
        variant === 'primary'
          ? 'inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95'
          : 'inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted',
        pending && 'cursor-wait opacity-70'
      )}
    >
      {pending ? (pendingLabel ?? 'Working…') : children}
    </button>
  )
}
