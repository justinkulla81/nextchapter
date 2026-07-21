'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import {
  ACTION_TYPE_LINK,
  estimateActionEffort,
  formatMinutes,
  isRecurringActionType,
  type SuggestedActionLike,
} from '@/lib/weekly/action-effort'
import type { CommittedAction } from '@/lib/weekly/sprint'
import { CATEGORY_MINIMUM_ENFORCED_FROM_WEEK, SEARCH_EXECUTION_ENGINE_LABEL } from '@/lib/scoring/grade'
import type { Grade, SearchExecutionEngine } from '@/lib/scoring/grade'
import { toggleSprintAction, completeCatalogAction } from '@/app/dashboard/sprint/actions'
import { SprintSetupForm } from '@/components/dashboard/SprintSetupForm'
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

function ActionRow({
  text,
  points,
  estimatedMinutes,
  actionType,
  completed,
  recurring,
  committed,
  onToggle,
  onLog,
}: {
  text: string
  points: number
  estimatedMinutes: number
  actionType?: string
  completed: boolean
  recurring: boolean
  committed: boolean
  // Omitted entirely for actions that can't be revised right now (e.g. the
  // "Defined this week's goal" line outside the edit window) — no button
  // renders rather than a disabled one, since there's nothing to explain.
  onToggle?: () => void
  onLog?: { text: string; actionType?: string }
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
        {recurring ? (
          completed ? (
            <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">Started</span>
          ) : onToggle ? (
            <form action={onToggle}>
              <SubmitButton variant="outline" size="sm">
                Mark started
              </SubmitButton>
            </form>
          ) : (
            onLog && (
              <form action={completeCatalogAction}>
                <input type="hidden" name="text" value={onLog.text} />
                {onLog.actionType && <input type="hidden" name="actionType" value={onLog.actionType} />}
                <SubmitButton variant="outline" size="sm">
                  Mark started
                </SubmitButton>
              </form>
            )
          )
        ) : onToggle ? (
          <form action={onToggle}>
            <SubmitButton variant={completed ? 'ghost' : 'outline'} size="sm">
              {completed ? 'Edit' : 'Mark done'}
            </SubmitButton>
          </form>
        ) : (
          onLog && (
            <form action={completeCatalogAction}>
              <input type="hidden" name="text" value={onLog.text} />
              {onLog.actionType && <input type="hidden" name="actionType" value={onLog.actionType} />}
              <SubmitButton variant="outline" size="sm">
                Mark done
              </SubmitButton>
            </form>
          )
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
  weeklyPointsTarget,
  onTrack,
}: {
  actions: CommittedAction[] | null
  suggestedActions: SuggestedAction[]
  marketRealityGrade: Grade
  weekNumber: number
  editWindowOpen: boolean
  weeklySprintsCount: number
  engines: SearchExecutionEngine[]
  laggingEngines: SearchExecutionEngine['key'][]
  categoryMinimumsMet: boolean
  weeklyPoints: number
  weeklyPointsTarget: number
  onTrack: boolean
}) {
  const committedTier = actions?.filter((a) => !a.addedFromCatalog) ?? []
  const loggedExtras = actions?.filter((a) => a.addedFromCatalog) ?? []

  const usedKeys = new Set((actions ?? []).map(actionKey))
  const availableCatalog = suggestedActions.filter((sa) => !usedKeys.has(actionKey(sa)))

  const oneTimeTotal = (actions ?? []).filter((a) => !a.recurring).length
  const oneTimeDone = (actions ?? []).filter((a) => !a.recurring && a.completed).length
  const recurringStarted = (actions ?? []).filter((a) => a.recurring && a.completed).length

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
              <span className="tabular-nums">{weeklyPointsTarget}</span> points this week
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
                Your Committed Actions
              </p>
              <div className="space-y-1.5">
                {committedTier.map((action, i) => {
                  const realIndex = actions.indexOf(action)
                  // The goal-defined bonus line isn't a real action to revise —
                  // only offer to edit it while the window that created it is
                  // still open; otherwise show it with no control at all.
                  const canEdit = !action.isGoalBonus || editWindowOpen
                  return (
                    <ActionRow
                      key={i}
                      text={action.text}
                      points={action.points}
                      estimatedMinutes={action.estimatedMinutes}
                      actionType={action.actionType}
                      completed={action.completed}
                      recurring={action.recurring}
                      committed
                      onToggle={canEdit ? toggleSprintAction.bind(null, realIndex) : undefined}
                    />
                  )
                })}
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
                          onLog={{ text: action.text, actionType: action.actionType }}
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
              <p className="text-sm text-muted-foreground">
                Your report is still generating — check back in a moment for suggested actions.
              </p>
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
              From here on, an A in Search Action Grade requires real work across all four
              engines — not just one you&apos;re comfortable with.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {engines.map((e) => (
                <li key={e.key} className="flex items-center gap-2">
                  <span>{laggingEngines.includes(e.key) ? '☐' : '☑'}</span>
                  <span className="text-foreground">{SEARCH_EXECUTION_ENGINE_LABEL[e.key]}</span>
                  {laggingEngines.includes(e.key) && (
                    <span className="text-xs text-muted-foreground">needs real work this week</span>
                  )}
                </li>
              ))}
            </ul>
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
