'use client'

import { useState, useTransition } from 'react'
import {
  promoteQueueOpportunity,
  snoozeOrgFromQueue,
  snoozePersonFromQueue,
} from '@/app/support/admin/(portal)/crm/queue/actions'

export function QueueRowActions({
  opportunityId,
  orgId,
  personId,
}: {
  /** When set, shows a "Promote" button that advances this opportunity a stage. */
  opportunityId?: string
  orgId?: string
  personId?: string
}) {
  const [pending, startTransition] = useTransition()
  const [hidden, setHidden] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (hidden) return <span className="text-xs text-muted-foreground">Dismissed</span>

  return (
    <span className="flex shrink-0 items-center gap-1">
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
      {opportunityId && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => setMessage((await promoteQueueOpportunity(opportunityId)).message))}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
        >
          Promote →
        </button>
      )}
      {(orgId || personId) && (
        <button
          type="button"
          disabled={pending}
          title="Dismiss from today's queue — reappears if something new comes up"
          onClick={() =>
            startTransition(async () => {
              if (orgId) await snoozeOrgFromQueue(orgId)
              if (personId) await snoozePersonFromQueue(personId)
              setHidden(true)
            })
          }
          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          ✕
        </button>
      )}
    </span>
  )
}
