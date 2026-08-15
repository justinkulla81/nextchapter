'use client'

import { useActionState } from 'react'
import { triggerSurgeOutreachAction } from '@/app/support/admin/(portal)/coaching-reassignments/actions'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

export function SurgeOutreachForm({ benchCoachCount }: { benchCoachCount: number }) {
  const [state, formAction, pending] = useActionState(triggerSurgeOutreachAction, undefined)

  return (
    <form action={formAction} className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <Textarea name="note" rows={2} placeholder="Optional note included in the email (e.g. what's driving the surge)" />
      {benchCoachCount === 0 ? (
        <p className="text-xs text-muted-foreground">
          No coaches are on the surge bench yet — add at least one from a coach&apos;s detail page before
          triggering outreach.
        </p>
      ) : (
        <SubmitButton size="sm" pendingLabel="Sending…">
          Trigger surge outreach ({benchCoachCount} bench coach{benchCoachCount === 1 ? '' : 'es'})
        </SubmitButton>
      )}
      {state?.success && <p className="text-xs text-success">Outreach sent and logged.</p>}
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  )
}
