import type { NextStep } from '@/lib/scoring/employability-score'

export function NextStepsList({ nextSteps }: { nextSteps: NextStep[] }) {
  if (nextSteps.length === 0) return null

  return (
    <div className="w-full space-y-2 text-left">
      <h3 className="text-sm font-medium text-muted-foreground">Next steps</h3>
      <ul className="space-y-2">
        {nextSteps.map((step) => (
          <li key={step.action} className="rounded-lg border border-border px-3 py-2 text-sm">
            {step.action}
          </li>
        ))}
      </ul>
    </div>
  )
}
