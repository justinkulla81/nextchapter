'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ACTION_TYPE_LINK,
  estimateActionEffort,
  formatMinutes,
  getRecurringTargetCount,
  isRecurringActionType,
  navCategoryForActionType,
  type SuggestedActionLike,
} from '@/lib/weekly/action-effort'
import type { CommittedAction } from '@/lib/weekly/sprint'
import { isProfileChecklistActionType } from '@/lib/weekly/profile-checklist-types'
import { CATEGORY_MINIMUM_ENFORCED_FROM_WEEK } from '@/lib/scoring/grade'
import type { WeeklyEngine } from '@/lib/scoring/grade'
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
  const navCategory = navCategoryForActionType(actionType)
  // For recurring actions with a known weekly rep target, show the count as
  // a suggested pace, not a points multiplier — a category only ever pays
  // out `points` once per week (see autoCompleteEngagementAction's doc
  // comment: "posting twice never doubles them"), so showing "2 x 15 = 30"
  // here would promise points the system doesn't actually award.
  const targetCount = recurring ? getRecurringTargetCount(actionType) : null
  const timeLabel = targetCount ? `Aim for ${targetCount}× this week` : formatMinutes(estimatedMinutes)
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border px-3 py-2',
        committed ? 'border-border bg-off-white' : 'border-dashed border-muted-foreground/30 bg-transparent'
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {completed && (
          <span className={cn('shrink-0', recurring ? 'text-brand' : 'text-success')} aria-hidden>
            ✓
          </span>
        )}
        <Link
          href={link?.href ?? '/dashboard'}
          className={cn(
            'truncate text-sm hover:underline',
            completed && !recurring ? 'text-muted-foreground line-through' : 'text-foreground'
          )}
        >
          {text}
        </Link>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {recurring ? 'Recurring' : 'One-time'}
        </span>
        {navCategory && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {navCategory}
          </span>
        )}
        {!committed && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Not committed
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-xs text-muted-foreground tabular-nums">{timeLabel}</span>
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand tabular-nums">
          {points} pts
        </span>
      </div>
    </div>
  )
}

export function SuccessSprintCard({
  actions,
  suggestedActions,
  weeklySprintsCount,
  engines,
  laggingEngines,
  categoryMinimumsMet,
  weeklyPoints,
  weeklyPointsTarget,
  weeklyVisibilityBonus,
  onTrack,
}: {
  actions: CommittedAction[] | null
  suggestedActions: SuggestedAction[]
  weeklySprintsCount: number
  engines: WeeklyEngine[]
  laggingEngines: WeeklyEngine['key'][]
  categoryMinimumsMet: boolean
  weeklyPoints: number
  weeklyPointsTarget: number
  weeklyVisibilityBonus: number
  onTrack: boolean
}) {
  // Profile-checklist items (Confirm your industry, Privacy setting, etc.)
  // still count toward weeklyPoints/oneTimePointsEarned below — only their
  // rendered rows are excluded here, since they now live entirely on
  // /dashboard/complete-profile (see ProfileChecklistCard).
  const realActions = (actions ?? []).filter((a) => !isProfileChecklistActionType(a.actionType))
  const committedTier = realActions.filter((a) => !a.addedFromCatalog)
  const loggedExtras = realActions.filter((a) => a.addedFromCatalog)

  const usedKeys = new Set((actions ?? []).map(actionKey))
  const availableCatalog = suggestedActions.filter(
    (sa) => !usedKeys.has(actionKey(sa)) && !isProfileChecklistActionType(sa.actionType)
  )

  const oneTimeTotal = realActions.filter((a) => !a.recurring).length
  const oneTimeDone = realActions.filter((a) => !a.recurring && a.completed).length
  // Splits weeklyPoints by kind so the blended total doesn't obscure how much
  // came from a real finish line (one-time) vs a habit that resets next week
  // (recurring) — see the isRecurringActionType doc comment in CommittedAction.
  const oneTimePointsEarned = (actions ?? [])
    .filter((a) => !a.recurring && a.completed)
    .reduce((sum, a) => sum + a.points, 0)
  const recurringPointsEarned = (actions ?? [])
    .filter((a) => a.recurring && a.completed)
    .reduce((sum, a) => sum + a.points, 0)
  // These three should always sum to weeklyPoints — breaking it out here
  // (rather than just showing the blended total) is what makes "why did my
  // points change" answerable from this card alone.
  const pointsBreakdown = [
    oneTimePointsEarned > 0 ? `${oneTimePointsEarned} pts one-time` : null,
    recurringPointsEarned > 0 ? `${recurringPointsEarned} pts recurring` : null,
    weeklyVisibilityBonus > 0 ? `${weeklyVisibilityBonus} pts for being publicly visible` : null,
  ].filter(Boolean)

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
            {pointsBreakdown.length > 0 && (
              <p className="text-xs text-muted-foreground tabular-nums">{pointsBreakdown.join(' + ')}</p>
            )}
            <p className={cn('mt-1 text-2xl font-bold', onTrack ? 'text-success' : 'text-muted-foreground')}>
              {onTrack ? 'On track' : 'Behind pace'}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {oneTimeTotal > 0 && oneTimeDone === oneTimeTotal
                ? 'All one-time actions done for this sprint ✓'
                : `${oneTimeDone} of ${oneTimeTotal} one-time action${oneTimeTotal === 1 ? '' : 's'} done`}
              {recurringPointsEarned > 0 && ` · ${recurringPointsEarned} pts earned from recurring activity this week`}
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
              <p className="text-xs text-muted-foreground">
                One-time actions count once, ever. Recurring actions count once per week — do them
                again next week to earn those points again.
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
              This week&apos;s goals are being set — check back shortly.
            </p>
          )}
        </div>

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
