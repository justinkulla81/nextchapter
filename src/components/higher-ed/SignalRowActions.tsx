'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { approveGratitude, dismissGratitude, setSignal } from '@/app/i/[slug]/(portal)/development-actions'

// Per-row controls on Development › Signals. Dismiss has an Undo instead of
// a confirm: nothing leaves the building, so it's cheap to take back.
// Sending a thank-you does email the alum, so it confirms first.
export function SignalRowActions(props: { slug: string; id: string; kind: string; approved: boolean; blocked: boolean; isDemo: boolean }) {
  const [pending, start] = useTransition()
  const [state, setState] = useState<'idle' | 'dismissed' | 'approved' | 'sent' | 'confirm'>(props.approved ? 'approved' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const run = (fn: () => Promise<{ error?: string; message?: string }>, next: typeof state) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (r.error) setError(r.error)
      else setState(next)
    })

  if (props.blocked) return <span className="text-xs text-muted-foreground">In transition: no asks until it clears</span>
  if (state === 'dismissed')
    return (
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        Dismissed
        {props.kind !== 'GRATITUDE' && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setSignal(props.slug, props.id, 'undo'), 'idle')}>
            Undo
          </Button>
        )}
      </span>
    )
  if (state === 'sent') return <span className="text-xs text-muted-foreground">{props.isDemo ? 'Recorded (demo, not emailed)' : 'Thank-you sent'}</span>

  return (
    <div className={cn('flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      {props.kind === 'GRATITUDE' ? (
        state === 'confirm' ? (
          <>
            <span className="text-xs">{props.isDemo ? 'Record the thank-you?' : 'Email the thank-you with your giving link?'}</span>
            <Button size="sm" disabled={pending} onClick={() => run(() => approveGratitude(props.slug, [props.id]), 'sent')}>
              {pending ? 'Sending…' : 'Send thank-you'}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setState('idle')} autoFocus>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" disabled={pending} onClick={() => setState('confirm')}>
              Send thank-you
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => dismissGratitude(props.slug, props.id), 'dismissed')}>
              Dismiss
            </Button>
          </>
        )
      ) : state === 'approved' ? (
        <span className="text-xs text-muted-foreground">Approved: goes out in the next CRM updates file</span>
      ) : (
        <>
          <Button size="sm" disabled={pending} onClick={() => run(() => setSignal(props.slug, props.id, 'approve'), 'approved')}>
            Approve for CRM
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setSignal(props.slug, props.id, 'dismiss'), 'dismissed')}>
            Dismiss
          </Button>
        </>
      )}
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  )
}
