'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { syncNowAction, forceFullResyncAction } from '@/app/dashboard/email-activity/actions'

export function EmailActivitySyncButton() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        className={cn(isPending && 'cursor-progress')}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await syncNowAction()
            if (result.error) setError(result.error)
          })
        }}
      >
        {isPending ? 'Checking…' : 'Check now'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// A routine "Check now" only looks back to the last successful sync, so a
// message from before the candidate's first sync (or missed during a gap)
// never surfaces from that button alone — this re-scans the last 90 days.
// Slower, so kept as an opt-in "not seeing something?" fallback rather than
// the default action.
export function EmailActivityForceResyncButton() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        className={cn(isPending && 'cursor-progress')}
        onClick={() => {
          setError(null)
          setDone(false)
          startTransition(async () => {
            const result = await forceFullResyncAction()
            if (result.error) setError(result.error)
            else setDone(true)
          })
        }}
      >
        {isPending ? 'Re-scanning last 90 days…' : "Not seeing something? Re-scan last 90 days"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {done && !error && <p className="text-xs text-muted-foreground">Done — refresh to see any new results.</p>}
    </div>
  )
}
