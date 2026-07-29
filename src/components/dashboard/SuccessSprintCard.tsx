'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InlineLoadingState } from '@/components/ui/spinner'
import {
  ACTION_TYPE_LINK,
  estimateActionEffort,
  formatMinutes,
  isRecurringActionType,
  type SuggestedActionLike,
} from '@/lib/weekly/action-effort'
import type { CommittedAction } from '@/lib/weekly/sprint'
import { CATEGORY_MINIMUM_ENFORCED_FROM_WEEK } from '@/lib/scoring/grade'
import type { Grade, WeeklyEngine } from '@/lib/scoring/grade'
import { SprintSetupForm } from '@/components/dashboard/SprintSetupForm'
import { WeeklyEngineChecklist } from '@/components/dashboard/WeeklyEngineChecklist'
import { cn } from '@/lib/utils'

interface SuggestedAction extends SuggestedActionLike {
  text: string
}

// A committed action's identity for de-duplication against the catalog —
// actionType when there is one (canonical Search Actions), otherwise the
// exact text (personalized, LLM-suggested items with no fixed type).
function actionKey(a: { actionType?: string; text: string }): string {
  return a.actionType ?? a.text
}

// Read-only summary row — marking an action done/started happens on the
// real feature page it links to (see SprintActionCompletion), not here.
// This card's job is to show status and route you to where the work
// actually happens.
function ActionRow({
  text,
  points,
  estimatedMinutes,
  actionType,
  completed,
  recurring,
  committed,
}: {
  text: string
  points: number
  estimatedMinutes: number
  actionType?: string
  completed: boolean
  recurring: boolean
  committed: boolean
}) {
  const link = actionType ? ACTION_TYPE_LINK[actionType] : undefined
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border px-3 py-2',
        committed ? 'border-border bg-off-white' : 'border-dashed border-muted-foreground/30 bg-transparent'
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={link?.href ?? '/dashboard'}
          className={`truncate text-sm hover:underline ${
            completed && !recurring ? 'text-muted-foreground line-through' : 'text-foreground'
          }`}
        >
          {completed && !recurring ? '✓ ' : ''}
          {text}
        </Link>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {recurring ? 'Recurring' : 'One-time'}
        </span>
        {!committed && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Not committed
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatMinutes(estimatedMinutes)} · {points} pts
        </span>
        {recurring && completed && (
          <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">Started</span>
        )}
      </div>
    </div>
  )
}

export function SuccessSprintCard({
  actions,
  suggestedActions,
  marketRealityGrade,
  weekNumber,
  editWindowOpen,
  weeklySprintsCount,
  engines,
  laggingEngines,
  categoryMinimumsMet,
  weeklyPoints,
  onTrack,
}: {
  actions: CommittedAction[] | null
  suggestedActions: SuggestedAction[]
  marketRealityGrade: Grade
  weekNumber: number
  editWindowOpen: boolean
  weeklySprintsCount: number
  engines: WeeklyEngine[]
  laggingEngines: WeeklyEngine['key'][]
  categoryMinimumsMet: boolean
  weeklyPoints: number
  onTrack: boolean
}) {
  const committedTier = actions?.filter((a) => !a.addedFromCatalog) ?? []
  const loggedExtras = actions?.filter((a) => a.addedFromCatalog) ?? []

  const usedKeys = new Set((actions ?? []).map(actionKey))
  const availableCatalog = suggestedActions.filter((sa) => !usedKeys.has(actionKey(sa)))

  const oneTimeTotal = (actions ?? []).filter((a) => !a.recurring).length
  const oneTimeDone = (actions ?? []).filter((a) => !a.recurring && a.completed).length
  const recurringStarted = (actions ?? []).filter((a) => a.recurring && a.completed).length

  // The header's denominator must equal the sum of what's actually listed
  // below it (committedTier's points) — using the system's ramp target here
  // instead would show an unreachable number whenever a candidate committed
  // to less than the full ramp (a fully supported, common case: goal-setting
  // only requires clearing the B bar, not the A bar). weeklyPointsTarget
  // still drives the separate On track/Behind pace pacing pill below.
  const committedPointsTotal = committedTier.reduce((sum, a) => sum + a.points, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Weekly Search Sprint</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">This week&apos;s goals</h3>

          <div
            className={cn(
              'rounded-lg border-2 p-4',
              onTrack ? 'border-success bg-success/5' : 'border-border bg-muted/40'
            )}
          >
            <p className="text-lg font-semibold text-foreground">
              <span className="tabular-nums">{weeklyPoints}</span> of{' '}
              <span className="tabular-nums">{committedPointsTotal}</span> points this week
            </p>
            <p className={cn('mt-1 text-2xl font-bold', onTrack ? 'text-success' : 'text-muted-foreground')}>
              {onTrack ? 'On track' : 'Behind pace'}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {oneTimeDone} of {oneTimeTotal} one-time action{oneTimeTotal === 1 ? '' : 's'} done
              {recurringStarted > 0 &&
                ` · ${recurringStarted} recurring action${recurringStarted === 1 ? '' : 's'} started`}
            </p>
          </div>

          {actions && actions.length > 0 ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total Weekly Committed Actions
              </p>
              <p className="text-xs text-muted-foreground">
                Click into an action below to go mark it done or started — completion happens on
                that page, not here.
              </p>
              <div className="space-y-1.5">
                {committedTier.map((action, i) => (
                  <ActionRow
                    key={i}
                    text={action.text}
                    points={action.points}
                    estimatedMinutes={action.estimatedMinutes}
                    actionType={action.actionType}
                    completed={action.completed}
                    recurring={action.recurring}
                    committed
                  />
                ))}
              </div>

              {(loggedExtras.length > 0 || availableCatalog.length > 0) && (
                <>
                  <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    More Actions Available
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Not part of your official commitment, but completing any of these still adds to
                    this week&apos;s points.
                  </p>
                  <div className="space-y-1.5">
                    {loggedExtras.map((action, i) => (
                      <ActionRow
                        key={`extra-${i}`}
                        text={action.text}
                        points={action.points}
                        estimatedMinutes={action.estimatedMinutes}
                        actionType={action.actionType}
                        completed={action.completed}
                        recurring={action.recurring}
                        committed={false}
                      />
                    ))}
                    {availableCatalog.map((action, i) => {
                      const effort = estimateActionEffort(action)
                      return (
                        <ActionRow
                          key={`available-${i}`}
                          text={action.text}
                          points={effort.points}
                          estimatedMinutes={effort.minutes}
                          actionType={action.actionType}
                          completed={false}
                          recurring={isRecurringActionType(action.actionType)}
                          committed={false}
                        />
                      )
                    })}
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t set goals for this week yet
              {editWindowOpen ? ' — use the form below.' : '.'}
            </p>
          )}
        </div>

        {editWindowOpen && (
          <div className="space-y-3 border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-foreground">Set next week&apos;s goals</h3>
            {suggestedActions.length === 0 ? (
              <InlineLoadingState label="Your report is still generating — check back in a moment for suggested actions." />
            ) : (
              <SprintSetupForm
                suggestedActions={suggestedActions}
                marketRealityGrade={marketRealityGrade}
                weekNumber={weekNumber}
              />
            )}
          </div>
        )}

        {weeklySprintsCount >= CATEGORY_MINIMUM_ENFORCED_FROM_WEEK && (
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-medium text-foreground">Week 4+ Requirements</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              From here on, an A requires real work across all four areas — not just one
              you&apos;re comfortable with.
            </p>
            <div className="mt-3">
              <WeeklyEngineChecklist engines={engines} laggingEngines={laggingEngines} />
            </div>
            {!categoryMinimumsMet && (
              <p className="mt-3 text-sm font-medium text-foreground">
                Your grade is capped at B until every engine clears the bar — real effort spread
                across all four, not stacked in one.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
