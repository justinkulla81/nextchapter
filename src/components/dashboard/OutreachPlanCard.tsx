'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import type { NetworkComfortLevel, NetworkingAnxiety } from '@prisma/client'
import { getOutreachPlan } from '@/lib/network/scripts'
import { dismissOutreachPlan } from '@/app/dashboard/network/actions'
import { NetworkingAnxietySelector } from '@/components/dashboard/NetworkingAnxietySelector'
import { NetworkConnectPreferenceSelector } from '@/components/dashboard/NetworkConnectPreferenceSelector'

// One condensed line per comfort-level answer — this card is responding
// directly to that answer, so it says so instead of reading as a
// standalone, unexplained message. Trimmed to one sentence: the "most
// roles get filled through a connection" framing already lives in the
// page's own <h1> subtitle, so it doesn't need repeating a third time.
const COMFORT_RESPONSE: Record<NetworkComfortLevel, string> = {
  VERY_COMFORTABLE: "You said you're comfortable letting your network know you're looking — good, that's a real advantage most people don't start with.",
  SOMEWHAT_COMFORTABLE:
    "You said you're somewhat comfortable with this. That's normal — you don't have to feel fully ready, just willing to send one message.",
  NOT_VERY_COMFORTABLE:
    "You said this doesn't feel very comfortable yet. Start with the one or two people who'd be easiest to reach out to, not the hardest.",
  RATHER_NOT: "You said you'd rather not — that's honest, and this part of a search does ask something real of you.",
}

export function OutreachPlanCard({
  concerns,
  connectPreferences,
  comfortLevel,
  dismissedAlready,
}: {
  concerns: NetworkingAnxiety[]
  connectPreferences: string[]
  comfortLevel: NetworkComfortLevel
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
      <p className="pr-6 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Daily Message</p>
      <h2 className="pr-6 text-sm font-semibold text-navy">Your outreach plan</h2>
      <p className="text-sm text-foreground">{COMFORT_RESPONSE[comfortLevel]}</p>
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
      <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground">
        <strong className="font-semibold">Tip:</strong> star the people you most want to follow up with below —
        starred contacts show up as reminders on your Success Dashboard until you email them.
      </p>
      <details className="pt-1 text-sm">
        <summary className="cursor-pointer font-medium text-primary">Not resonating? Adjust your answers</summary>
        <div className="mt-3 space-y-4">
          <NetworkingAnxietySelector current={concerns} />
          <NetworkConnectPreferenceSelector current={connectPreferences} />
        </div>
      </details>
    </div>
  )
}
