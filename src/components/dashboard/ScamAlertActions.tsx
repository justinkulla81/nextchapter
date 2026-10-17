'use client'

import { useState, useTransition } from 'react'
import { acknowledgeScamAlert, markScamAlertLegit } from '@/app/dashboard/scam-watch/actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Primary action: acknowledge. "This one is real" is the risky direction (it
// removes a warning), so it takes a second, explicit confirmation that is
// never the default focus.
export function ScamAlertActions({ alertId }: { alertId: string }) {
  const [pending, start] = useTransition()
  const [confirmingLegit, setConfirmingLegit] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = (action: (id: string) => Promise<{ error?: string }>) =>
    start(async () => {
      const result = await action(alertId)
      setError(result.error ?? null)
    })

  if (confirmingLegit) {
    return (
      <div className={cn('space-y-2', pending && 'cursor-progress')} role="group" aria-label="Confirm this email is legitimate">
        <p className="text-sm text-foreground">
          Only choose this if you confirmed the recruiter another way, like calling the company using the number on its own website.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setConfirmingLegit(false)}>
            Keep the warning
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run(markScamAlertLegit)}>
            {pending ? 'Saving…' : 'Yes, mark as legitimate'}
          </Button>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', pending && 'cursor-progress')}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={() => run(acknowledgeScamAlert)}>
          {pending ? 'Saving…' : "Got it, I won't engage"}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setConfirmingLegit(true)}>
          This looks legitimate
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
