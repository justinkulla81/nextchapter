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

function formatHoursMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

export function SprintSetupForm({
  suggestedActions,
  marketRealityGrade,
  locked = false,
}: {
  suggestedActions: SuggestedAction[]
  marketRealityGrade: Grade
  locked?: boolean
}) {
  const [state, formAction, pending] = useActionState(submitWeeklySprint, undefined)
  const [selected, setSelected] = useState<boolean[]>(suggestedActions.map(() => true))

  const efforts = useMemo(() => suggestedActions.map((a) => estimateActionEffort(a)), [suggestedActions])
  const maxPoints = useMemo(() => efforts.reduce((sum, e) => sum + e.points, 0), [efforts])
  const maxMinutes = useMemo(() => efforts.reduce((sum, e) => sum + e.minutes, 0), [efforts])
  const { aThreshold, bThreshold } = useMemo(() => sprintPointThresholds(maxPoints), [maxPoints])
  const committedPoints = useMemo(
    () => efforts.reduce((sum, e, i) => (selected[i] ? sum + e.points : sum), 0),
    [efforts, selected]
  )
  const committedMinutes = useMemo(
    () => efforts.reduce((sum, e, i) => (selected[i] ? sum + e.minutes : sum), 0),
    [efforts, selected]
  )
  const meetsA = committedPoints >= aThreshold
  const meetsB = committedPoints >= bThreshold
  const pointsToB = Math.max(0, bThreshold - committedPoints)

  function toggle(i: number) {
    setSelected((prev) => prev.map((v, idx) => (idx === i ? !v : v)))
  }

  return (
    <form
      action={formAction}
      className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <input type="hidden" name="actionCount" value={suggestedActions.length} />

      <div
        className={cn(
          'rounded-lg border-2 p-4',
          meetsA ? 'border-success bg-success/5' : meetsB ? 'border-brand bg-brand/5' : 'border-border bg-muted/40'
        )}
      >
        <p className="text-lg font-semibold text-foreground">
          You&apos;re committing to <span className="tabular-nums">{committedPoints}</span> points —{' '}
          <span className="tabular-nums">{formatHoursMinutes(committedMinutes)}</span>
        </p>
        <p
          className={cn(
            'mt-1 text-2xl font-bold',
            meetsA ? 'text-success' : meetsB ? 'text-brand' : 'text-muted-foreground'
          )}
        >
          {meetsA ? 'On track for an A' : meetsB ? 'On track for a B' : 'Below B — pick more actions'}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          All {maxPoints} points ({formatHoursMinutes(maxMinutes)}) earns an A this week. {bThreshold} points earns
          a B.
        </p>
        {!meetsB && (
          <p className="mt-1 text-sm font-medium text-destructive">
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

      <div className="divide-y divide-border rounded-lg border border-border">
        {suggestedActions.map((action, i) => {
          const effort = efforts[i]
          return (
            <div
              key={i}
              role={locked ? undefined : 'button'}
              tabIndex={locked ? undefined : 0}
              onClick={locked ? undefined : () => toggle(i)}
              onKeyDown={
                locked
                  ? undefined
                  : (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggle(i)
                      }
                    }
              }
              className={cn(
                'flex items-start gap-3 p-4 transition-colors',
                locked ? 'cursor-default' : 'cursor-pointer',
                selected[i] ? 'bg-brand/5' : !locked && 'hover:bg-muted/40'
              )}
            >
              <input type="hidden" name={`text_${i}`} value={action.text} />
              {action.actionType && <input type="hidden" name={`actionType_${i}`} value={action.actionType} />}
              <input type="hidden" name={`isAStandard_${i}`} value={action.isAStandard ? 'true' : 'false'} />
              <input type="hidden" name={`isStretch_${i}`} value={action.isStretch ? 'true' : 'false'} />
              <Checkbox
                name={`selected_${i}`}
                value="on"
                checked={selected[i]}
                disabled={locked}
                onCheckedChange={locked ? undefined : () => toggle(i)}
                onClick={locked ? undefined : (e) => e.stopPropagation()}
                className="mt-0.5"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{action.text}</p>
                <p className="mt-1 text-base font-semibold text-foreground">{formatMinutes(effort.minutes)}</p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-sm font-bold tabular-nums',
                  selected[i] ? 'bg-brand text-white' : 'bg-muted text-muted-foreground'
                )}
              >
                {selected[i] ? effort.points : 0} pts
              </span>
            </div>
          )
        })}
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      {locked ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span aria-hidden>🔒</span> Unlocks Saturday midnight PT through Monday midnight PT, ahead
          of next week.
        </p>
      ) : (
        <Button type="submit" disabled={pending || !meetsB} className="cursor-pointer">
          {pending ? 'Committing…' : "Commit to this week's goals"}
        </Button>
      )}
    </form>
  )
}
