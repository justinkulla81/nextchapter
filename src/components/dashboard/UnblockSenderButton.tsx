'use client'

import { useState, useTransition } from 'react'
import { unblockSender } from '@/app/dashboard/network/actions'
import { cn } from '@/lib/utils'

export function UnblockSenderButton({ id, value }: { id: string; value: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className={cn('flex flex-col items-end gap-1', pending && 'cursor-wait')}>
      <button
        type="button"
        disabled={pending}
        aria-label={`Unblock ${value}`}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            try {
              const result = await unblockSender(id)
              if (result.error) setError(result.error)
            } catch {
              setError("We couldn't unblock that sender just now. Check your connection and try again.")
            }
          })
        }
        className={cn(
          'h-7 rounded-md border border-input px-2 text-xs font-medium text-foreground hover:bg-muted',
          pending && 'cursor-wait opacity-60'
        )}
      >
        {pending ? 'Unblocking…' : 'Unblock'}
      </button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
