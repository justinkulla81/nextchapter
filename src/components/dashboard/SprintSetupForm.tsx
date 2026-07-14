'use client'

import { useActionState, useMemo, useState } from 'react'
import { submitWeeklySprint } from '@/app/dashboard/sprint/actions'
import {
  estimateActionEffort,
  formatMinutes,
  sprintPointThresholds,
  type SuggestedActionLike,
} from '@/lib/weekly/action-effort'
import type { Grade } from '@/lib/scoring/grade'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface SuggestedAction extends SuggestedActionLike {
  text: string
}

export function SprintSetupForm({
  suggestedActions,
  marketRealityGrade,
}: {
  suggestedActions: SuggestedAction[]
  marketRealityGrade: Grade
}) {
  const [state, formAction, pending] = useActionState(submitWeeklySprint, undefined)
  const [selected, setSelected] = useState<boolean[]>(suggestedActions.map(() => true))

  const efforts = useMemo(() => suggestedActions.map((a) => estimateActionEffort(a)), [suggestedActions])
  const maxPoints = useMemo(() => efforts.reduce((sum, e) => sum + e.points, 0), [efforts])
  const { aThreshold, bThreshold } = useMemo(() => sprintPointThresholds(maxPoints), [maxPoints])
  const committedPoints = useMemo(
    () => efforts.reduce((sum, e, i) => (selected[i] ? sum + e.points : sum), 0),
    [efforts, selected]
  )
  const meetsA = committedPoints >= aThreshold
  const meetsB = committedPoints >= bThreshold
  const pointsToB = Math.max(0, bThreshold - committedPoints)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="actionCount" value={suggestedActions.length} />
      <div className="divide-y divide-border rounded-lg border border-border">
        {suggestedActions.map((action, i) => {
          const effort = efforts[i]
          return (
            <div key={i} className="flex items-start gap-3 p-4">
              <input type="hidden" name={`text_${i}`} value={action.text} />
              {action.actionType && <input type="hidden" name={`actionType_${i}`} value={action.actionType} />}
              <input type="hidden" name={`isAStandard_${i}`} value={action.isAStandard ? 'true' : 'false'} />
              <input type="hidden" name={`isStretch_${i}`} value={action.isStretch ? 'true' : 'false'} />
              <Checkbox
                name={`selected_${i}`}
                value="on"
                checked={selected[i]}
                onCheckedChange={(checked) =>
                  setSelected((prev) => prev.map((v, idx) => (idx === i ? Boolean(checked) : v)))
                }
              />
              <div className="flex-1">
                <p className="text-sm text-foreground">{action.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatMinutes(effort.minutes)} · {effort.points} pts
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="font-medium text-foreground">
            {committedPoints} of {maxPoints} points committed
          </span>
          <span
            className={cn(
              'text-xs font-semibold',
              meetsA ? 'text-success' : meetsB ? 'text-brand' : 'text-muted-foreground'
            )}
          >
            {meetsA ? 'On track for an A' : meetsB ? 'On track for a B' : 'Below B — pick more actions'}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {maxPoints} points (all suggested actions) earns an A this week. {bThreshold} points earns a B.
        </p>
        {!meetsB && (
          <p className="mt-1 text-xs text-destructive">
            Add {pointsToB} more point{pointsToB === 1 ? '' : 's'} to lock in at least a B.
          </p>
        )}
        {meetsB && !meetsA && (
          <p className="mt-2 text-xs text-foreground">
            A B is real effort, but it&apos;s not everything — you&apos;re choosing to do most of this week&apos;s
            plan, not all of it. Given your current Market Reality grade of{' '}
            <span className="font-semibold">{marketRealityGrade}</span>,{' '}
            {marketRealityGrade === 'A' || marketRealityGrade === 'B'
              ? "your market position gives you some room, but every action you skip is ground you're not covering."
              : 'the market is already working against you, so a partial effort may not be enough to close that gap this week.'}
          </p>
        )}
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending || !meetsB}>
        {pending ? 'Committing…' : "Commit to this week's goals"}
      </Button>
    </form>
  )
}
