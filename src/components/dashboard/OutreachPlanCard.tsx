import type { NetworkingAnxiety } from '@prisma/client'
import { getOutreachPlan } from '@/lib/network/scripts'

export function OutreachPlanCard({
  concerns,
  connectPreferences,
}: {
  concerns: NetworkingAnxiety[]
  connectPreferences: string[]
}) {
  const plan = getOutreachPlan(concerns, connectPreferences)

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium text-foreground">Your outreach plan</h2>
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
