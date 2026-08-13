import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { CONFIDENCE_STYLE, type ConfidenceLevel } from '@/lib/scoring/grade'

export interface MixItem {
  label: string
  done: boolean
}

// Shared shell for the "Performance summary"-style progressive-unlock card
// (originally src/components/references/ReferenceCheckSummary.tsx) — a
// response/activity count drives a ConfidenceLevel tier, richer content
// unlocks as the count grows, and an optional "well-rounded set" checklist
// nudges toward variety once there's enough raw volume to make variety
// meaningful. Extracted here because the same shape now backs 5+ areas
// (Full-time Jobs, Networking, New Skills, Marketing Plan, Interim Work) —
// the original Reference Check card is left as its own component rather
// than migrated onto this one, since it already shipped and is stable.
export function TierSummaryCard({
  title,
  count,
  unitLabel,
  tier,
  buildingAt,
  highAt,
  unlockedContent,
  mixTitle,
  mixItems,
}: {
  title: string
  count: number
  /** Singular unit noun, e.g. "response" — pluralized automatically. */
  unitLabel: string
  tier: ConfidenceLevel
  /** Count threshold that reaches BUILDING, referenced only in the PROVISIONAL copy. */
  buildingAt: number
  /** Count threshold that reaches HIGH, referenced only in the PROVISIONAL copy. */
  highAt: number
  /** Rendered once tier is BUILDING or HIGH. */
  unlockedContent: ReactNode
  mixTitle?: string
  mixItems?: MixItem[]
}) {
  if (count === 0) return null

  const showUnlocked = tier !== 'PROVISIONAL'
  const mixSatisfied = !mixItems || mixItems.every((m) => m.done)
  const plural = count === 1 ? unitLabel : `${unitLabel}s`

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', CONFIDENCE_STYLE[tier])}>
            {count} {plural}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showUnlocked ? (
          unlockedContent
        ) : (
          <p className="text-sm text-muted-foreground">
            You&apos;re at {count} {plural} —{' '}
            {buildingAt === highAt
              ? `${highAt} or more unlocks the full view.`
              : `${buildingAt} or more unlocks more detail here; ${highAt} or more unlocks the full view.`}
          </p>
        )}

        {mixItems && !mixSatisfied && (
          <div className="space-y-1.5 border-t border-border pt-3 text-sm">
            {mixTitle && <p className="font-medium text-foreground">{mixTitle}</p>}
            {mixItems.map((item) => (
              <MixRow key={item.label} label={item.label} done={item.done} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MixRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className={cn('flex items-center gap-2', done ? 'text-success' : 'text-muted-foreground')}>
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-full border',
          done ? 'border-success bg-success/10' : 'border-border'
        )}
      >
        {done && <Check className="size-3" />}
      </span>
      {label}
    </div>
  )
}
