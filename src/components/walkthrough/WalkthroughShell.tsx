import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'

// One issue per screen (§13.1) — this shell is the only place step/progress
// chrome lives, so every step component below can stay focused on its own
// single primary action.
export function WalkthroughShell({
  step,
  totalSteps,
  title,
  children,
}: {
  step: number
  totalSteps: number
  title: string
  children: ReactNode
}) {
  const progressPercent = totalSteps > 1 ? Math.round((step / (totalSteps - 1)) * 100) : 100

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Step {step + 1} of {totalSteps}
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      </div>

      <Card>
        <CardContent className="pt-6">{children}</CardContent>
      </Card>
    </div>
  )
}
