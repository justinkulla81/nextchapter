'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// One button for an irreversible staff send: a confirm step that says
// exactly what happens, a busy cursor while it runs, and the result.
export function ConfirmActionButton(props: {
  label: string
  confirm: string
  confirmLabel: string
  run: () => Promise<{ error?: string; message?: string }>
  variant?: 'default' | 'outline'
}) {
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  return (
    <div className={cn('space-y-2', pending && 'cursor-wait')}>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">{props.confirm}</span>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await props.run()
                setMessage(r.error ? { text: r.error, error: true } : r.message ? { text: r.message, error: false } : null)
                setConfirming(false)
              })
            }
          >
            {pending ? 'Sending…' : props.confirmLabel}
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending} autoFocus>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant={props.variant ?? 'default'} onClick={() => setConfirming(true)}>
          {props.label}
        </Button>
      )}
      {message && (
        <p role={message.error ? 'alert' : 'status'} className={cn('text-sm', message.error ? 'text-destructive' : 'text-muted-foreground')}>
          {message.text}
        </p>
      )}
    </div>
  )
}
