import 'server-only'
import {
  getCurrentWeekSprint,
  getSuggestedActions,
  type CommittedAction,
} from '@/lib/weekly/sprint'
import { prisma } from '@/lib/prisma'
import { toggleSprintAction, completeCatalogAction } from '@/app/dashboard/sprint/actions'
import { isVerifiedActionType, isRecurringActionType, estimateActionEffort } from '@/lib/weekly/action-effort'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

// Marking a Weekly Search Sprint action done/started now only happens here
// — on the real feature page where the work actually gets done — not
// inline in the Sprint card on the dashboard (SuccessSprintCard), which is
// a read-only summary that links out to pages like this one. Drop this
// into any dashboard page whose actionTypes appear in ACTION_TYPE_LINK
// (action-effort.ts) pointing at that page. Renders nothing if none of the
// given action types are committed or available to log this week.
export async function SprintActionCompletion({
  candidateId,
  actionTypes,
}: {
  candidateId: string
  actionTypes: string[]
}) {
  const [sprint, weeklySprintsCount] = await Promise.all([
    getCurrentWeekSprint(candidateId),
    prisma.weeklySprint.count({ where: { candidateId } }),
  ])
  if (!sprint) return null

  const committedActions = sprint.committedActions as unknown as CommittedAction[]
  const committedRelevant = committedActions.filter(
    (a) => a.actionType && actionTypes.includes(a.actionType) && !isVerifiedActionType(a.actionType)
  )

  const usedKeys = new Set(committedActions.map((a) => a.actionType ?? a.text))
  const suggestedActions = await getSuggestedActions(candidateId, weeklySprintsCount + 1)
  const loggableRelevant = suggestedActions.filter(
    (a) =>
      a.actionType &&
      actionTypes.includes(a.actionType) &&
      !isVerifiedActionType(a.actionType) &&
      !usedKeys.has(a.actionType)
  )

  if (committedRelevant.length === 0 && loggableRelevant.length === 0) return null

  return (
    <div className="space-y-2 rounded-lg border border-border bg-off-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        This week&apos;s Sprint
      </p>
      <div className="space-y-1.5">
        {committedRelevant.map((action) => {
          const realIndex = committedActions.indexOf(action)
          return (
            <div key={realIndex} className="flex items-center justify-between gap-3">
              <span
                className={cn(
                  'text-sm',
                  action.completed && !action.recurring ? 'text-muted-foreground line-through' : 'text-foreground'
                )}
              >
                {action.completed && !action.recurring ? '✓ ' : ''}
                {action.text}{' '}
                <span className="text-xs text-muted-foreground">({action.points} pts)</span>
              </span>
              {action.recurring ? (
                action.completed ? (
                  <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
                    Started
                  </span>
                ) : (
                  <form action={toggleSprintAction.bind(null, realIndex)} className="shrink-0">
                    <SubmitButton variant="outline" size="sm">
                      Mark started
                    </SubmitButton>
                  </form>
                )
              ) : (
                <form action={toggleSprintAction.bind(null, realIndex)} className="shrink-0">
                  <SubmitButton variant={action.completed ? 'ghost' : 'outline'} size="sm">
                    {action.completed ? 'Edit' : 'Mark done'}
                  </SubmitButton>
                </form>
              )}
            </div>
          )
        })}
        {loggableRelevant.map((action) => {
          const effort = estimateActionEffort(action)
          const recurring = isRecurringActionType(action.actionType)
          return (
            <div key={action.actionType} className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">
                {action.text} <span className="text-xs text-muted-foreground">({effort.points} pts)</span>
              </span>
              <form action={completeCatalogAction} className="shrink-0">
                <input type="hidden" name="text" value={action.text} />
                {action.actionType && <input type="hidden" name="actionType" value={action.actionType} />}
                <SubmitButton variant="outline" size="sm">
                  {recurring ? 'Mark started' : 'Mark done'}
                </SubmitButton>
              </form>
            </div>
          )
        })}
      </div>
    </div>
  )
}
