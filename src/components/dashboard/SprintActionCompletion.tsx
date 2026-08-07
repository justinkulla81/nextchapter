import 'server-only'
import {
  getCurrentWeekSprint,
  getSuggestedActions,
  type CommittedAction,
} from '@/lib/weekly/sprint'
import { prisma } from '@/lib/prisma'
import { toggleSprintAction, completeCatalogAction } from '@/app/dashboard/sprint/actions'
import {
  isVerifiedActionType,
  isAutoDetectedActionType,
  isRecurringActionType,
  estimateActionEffort,
} from '@/lib/weekly/action-effort'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

// One line naming the real signal behind each auto-detected actionType —
// UI copy only, so it lives here rather than in action-effort.ts.
const AUTO_DETECTED_SIGNAL: Partial<Record<string, string>> = {
  OUTREACH_MESSAGE: 'Detected automatically when you send a networking message from your connected Gmail.',
  OUTREACH_CALL: 'Detected automatically from a networking call on your connected Calendar.',
  NETWORKING_LIST: 'Detected automatically when you add new contacts (CSV import).',
  FOLLOW_UP_NOTE_SENT: 'Detected automatically when you send a follow-up from your connected Gmail.',
  THANK_YOU_NOTE_SENT: 'Detected automatically when you send a thank-you note from your connected Gmail.',
  CHECK_IN_NOTE_SENT: 'Detected automatically when you send a check-in note from your connected Gmail.',
  INTRO_CONNECTION_REQUEST_SENT: 'Detected automatically when you ask for an introduction from your connected Gmail.',
  INTERVIEW_ATTENDED: 'Detected automatically from an interview on your connected Calendar.',
  LEARNING_SESSION_ATTENDED: 'Detected automatically from a course/webinar/training block on your connected Calendar.',
}

// Marking a Weekly Search Sprint action done/started now only happens here
// — on the real feature page where the work actually gets done — not
// inline in the Sprint card on the dashboard (SuccessSprintCard), which is
// a read-only summary that links out to pages like this one. Drop this
// into any dashboard page whose actionTypes appear in ACTION_TYPE_LINK
// (action-effort.ts) pointing at that page. Renders nothing if none of the
// given action types are committed or available to log this week.
//
// Self-report ("Mark done"/"Mark started") only ever renders for action
// types with NO real auto-detector — anything Gmail/Calendar/CSV-import can
// already verify (isAutoDetectedActionType) shows a plain status readout
// instead, for every candidate, with no partial-trust fallback. A
// self-report click is not evidence.
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
  const relevantCommitted = committedActions.filter(
    (a) => a.actionType && actionTypes.includes(a.actionType) && !isVerifiedActionType(a.actionType)
  )
  const selfReportCommitted = relevantCommitted.filter((a) => !isAutoDetectedActionType(a.actionType))

  const usedKeys = new Set(committedActions.map((a) => a.actionType ?? a.text))
  const suggestedActions = await getSuggestedActions(candidateId, weeklySprintsCount + 1)
  const relevantSuggested = suggestedActions.filter(
    (a) =>
      a.actionType &&
      actionTypes.includes(a.actionType) &&
      !isVerifiedActionType(a.actionType) &&
      !usedKeys.has(a.actionType)
  )
  const selfReportSuggested = relevantSuggested.filter((a) => !isAutoDetectedActionType(a.actionType))

  // Auto-detected rows: one per actionType, deduped across committed +
  // suggested (a committed/completed row wins over a merely-suggested one)
  // so the readout is visible even before the type has ever been committed
  // this week.
  const autoDetectedTypes = actionTypes.filter(isAutoDetectedActionType)
  const autoDetectedRows = autoDetectedTypes
    .map((actionType) => {
      const committed = relevantCommitted.find((a) => a.actionType === actionType)
      if (committed) return committed
      const suggested = relevantSuggested.find((a) => a.actionType === actionType)
      if (suggested) {
        const effort = estimateActionEffort(suggested)
        return { text: suggested.text, actionType, points: effort.points, completed: false } as CommittedAction
      }
      return null
    })
    .filter((a): a is CommittedAction => a !== null)

  if (selfReportCommitted.length === 0 && selfReportSuggested.length === 0 && autoDetectedRows.length === 0) {
    return null
  }

  return (
    <div className="space-y-2 rounded-lg border border-success/20 bg-success/5 p-3">
      <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Action Plan</p>
      <div className="space-y-1.5">
        {selfReportCommitted.map((action) => {
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
        {selfReportSuggested.map((action) => {
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
        {autoDetectedRows.map((action) => (
          <div key={action.actionType} className="space-y-0.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">
                {action.text} <span className="text-xs text-muted-foreground">({action.points} pts)</span>
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                  action.completed ? 'bg-brand/10 text-brand' : 'bg-muted text-muted-foreground'
                )}
              >
                {action.completed ? 'Detected ✓' : 'Not yet this week'}
              </span>
            </div>
            {AUTO_DETECTED_SIGNAL[action.actionType!] && (
              <p className="text-xs text-muted-foreground">{AUTO_DETECTED_SIGNAL[action.actionType!]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
