'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'

/** The primary submit button of a plain form post: says what it is doing and shows the busy cursor while it runs. */
export function PendingSubmit({ children, pendingText }: { children: ReactNode; pendingText: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={cn('inline-flex w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90', pending && 'cursor-wait opacity-80')}
    >
      {pending ? pendingText : children}
    </button>
  )
}
