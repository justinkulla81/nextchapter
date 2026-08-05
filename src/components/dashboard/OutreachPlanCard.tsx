'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import type { NetworkingAnxiety } from '@prisma/client'
import { getOutreachPlan } from '@/lib/network/scripts'
import { dismissOutreachPlan } from '@/app/dashboard/network/actions'

export function OutreachPlanCard({
  concerns,
  connectPreferences,
  dismissedAlready,
}: {
  concerns: NetworkingAnxiety[]
  connectPreferences: string[]
  dismissedAlready: boolean
}) {
  const [dismissed, setDismissed] = useState(dismissedAlready)
  const [, startTransition] = useTransition()
  const plan = getOutreachPlan(concerns, connectPreferences)

  if (dismissed) return null

  function dismiss() {
    setDismissed(true)
    startTransition(() => {
      dismissOutreachPlan()
    })
  }

  return (
    <div className="relative space-y-3 rounded-lg border border-brand/30 bg-brand/5 p-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss outreach plan"
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <h2 className="pr-6 text-sm font-medium text-foreground">Your outreach plan</h2>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Best time to reach out
        </p>
        <p className="mt-1 text-sm text-foreground">{plan.timing}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          When you actually talk
        </p>
        <ol className="mt-1 space-y-1">
          {plan.agenda.map((point, i) => (
            <li key={i} className="text-sm text-foreground">
              {i + 1}. {point}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
