import 'server-only'
import Link from 'next/link'
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
  getRecurringTargetCount,
  ACTION_TYPE_LINK,
  PAGE_ACTION_TYPE_OVERRIDE,
  type PageKey,
} from '@/lib/weekly/action-effort'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

// One line naming the real signal behind each auto-detected actionType —
// UI copy only, so it lives here rather than in action-effort.ts.
const AUTO_DETECTED_SIGNAL: Partial<Record<string, string>> = {
  OUTREACH_MESSAGE: 'Detected automatically when you send a networking message from your connected Gmail.',
  OUTREACH_CALL: 'Detected automatically from a networking call on your connected Calendar.',
  NETWORKING_LIST: 'Detected automatically when you add new contacts (CSV import).',
  FOLLOW_UP_NOTE_SENT: 'Detected automatically when you send a follow-up or thank-you note from your connected Gmail.',
  INTRO_CONNECTION_REQUEST_SENT: 'Detected automatically when you ask for an introduction from your connected Gmail.',
  INTERVIEW_ATTENDED: 'Detected automatically from an interview on your connected Calendar.',
  LEARNING_SESSION_ATTENDED: 'Detected automatically from a course/webinar/training block on your connected Calendar.',
  JOB_APPLICATION_SUBMITTED: 'Detected automatically when you mark a tracked job Applied on the Jobs page.',
  JOB_INTERESTED_REACTION: "Detected automatically when you react Interested to a job recommendation on the Jobs page.",
  WATCHLIST_ADD: 'Detected automatically when you add a company to your tracker on the Jobs page.',
  INTERVIEW_PREP: 'Detected automatically when you answer a practice or tough interview question in Interview Prep.',
}

// THANK_YOU_NOTE_SENT, FOLLOW_UP_NOTE_SENT, and CHECK_IN_NOTE_SENT are the
// same real-world action — reaching back out to someone — just different
// phrasing the Gmail classifier picked up on. Shown as one combined row
// (keyed to the first type present) rather than three near-identical ones,
// same reasoning as the stat-tile merge on the Network page. Only collapses
// when a page's actionTypes includes every type in the group — a page that
// only lists one of them (none currently do) keeps it as its own row.
// types[0] doubles as the representative key for React's list key and the
// AUTO_DETECTED_SIGNAL lookup below — must be a type that still has an
// entry there (FOLLOW_UP_NOTE_SENT does; the other two were folded into its
// message and removed as standalone keys).
const MERGED_AUTO_DETECTED_GROUPS: { types: string[]; label: string }[] = [
  { types: ['FOLLOW_UP_NOTE_SENT', 'THANK_YOU_NOTE_SENT', 'CHECK_IN_NOTE_SENT'], label: 'Follow-up or thank-you note sent' },
]

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
// Resolves where a row's real work happens — a page-specific override (see
// PAGE_ACTION_TYPE_OVERRIDE) wins over the actionType's global link, since a
// handful of types (NETWORKING_LIST, INTERVIEW_PREP) need to route into a
// section built specifically for this box rather than the page they
// otherwise live on. Returns null for actionTypes with no reachable link
// (row still renders, just as plain text).
function resolveRowLink(actionType: string | undefined, pageKey: PageKey | undefined) {
  if (!actionType) return null
  const override = pageKey ? PAGE_ACTION_TYPE_OVERRIDE[pageKey]?.[actionType] : undefined
  return override ?? ACTION_TYPE_LINK[actionType] ?? null
}

export async function SprintActionCompletion({
  candidateId,
  actionTypes,
  lifetimeProgress,
  pageKey,
}: {
  candidateId: string
  actionTypes: string[]
  // Optional "N of target" readout for an actionType with a real lifetime
  // goal (e.g. references: aim for 5) — distinct from the weekly recurring
  // target count (getRecurringTargetCount), which resets every week. Pass
  // per-page since the target is page-specific, not a property of the
  // actionType itself.
  lifetimeProgress?: Partial<Record<string, { current: number; target: number }>>
  // Which page rendered this box — used only to resolve PAGE_ACTION_TYPE_OVERRIDE
  // link/text overrides; omit and every row falls back to its global link.
  pageKey?: PageKey
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
  // A completed one-time item used to stay visible, struck through, for the
  // rest of the week it was done in (only hidden starting the following
  // week) — meant as a small "yes, you did this" acknowledgment. In
  // practice it just left stale, unclickable rows cluttering a box meant to
  // show what's left to do, so a completed one-time item now drops out of
  // the Action Plan immediately, same week or not. Recurring items are
  // unaffected — those never render struck through in the first place (see
  // the "Started" pill below), since there's no single finish line to
  // cross off.
  const selfReportCommitted = relevantCommitted.filter(
    (a) => !isAutoDetectedActionType(a.actionType) && !(a.completed && !a.recurring)
  )

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
  const rowForType = (actionType: string): CommittedAction | null => {
    const committed = relevantCommitted.find((a) => a.actionType === actionType)
    if (committed) return committed
    const suggested = relevantSuggested.find((a) => a.actionType === actionType)
    if (suggested) {
      const effort = estimateActionEffort(suggested)
      return {
        text: suggested.text,
        actionType,
        points: effort.points,
        estimatedMinutes: effort.minutes,
        completed: false,
        recurring: isRecurringActionType(actionType),
      }
    }
    return null
  }

  const mergedGroup = MERGED_AUTO_DETECTED_GROUPS.find((g) => g.types.every((t) => autoDetectedTypes.includes(t)))
  const singleTypes = mergedGroup ? autoDetectedTypes.filter((t) => !mergedGroup.types.includes(t)) : autoDetectedTypes
  const autoDetectedRows = singleTypes.map(rowForType).filter((a): a is CommittedAction => a !== null)

  if (mergedGroup) {
    const groupRows = mergedGroup.types.map(rowForType).filter((a): a is CommittedAction => a !== null)
    if (groupRows.length > 0) {
      autoDetectedRows.push({
        text: mergedGroup.label,
        actionType: mergedGroup.types[0],
        points: Math.max(...groupRows.map((r) => r.points)),
        estimatedMinutes: Math.max(...groupRows.map((r) => r.estimatedMinutes)),
        completed: groupRows.some((r) => r.completed),
        recurring: groupRows.some((r) => r.recurring),
      })
    }
  }

  if (selfReportCommitted.length === 0 && selfReportSuggested.length === 0 && autoDetectedRows.length === 0) {
    return null
  }

  return (
    <div className="space-y-2 rounded-lg border border-orange/30 bg-orange/5 p-3">
      <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Action Plan</p>
      <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
        {selfReportCommitted.map((action) => {
          const realIndex = committedActions.indexOf(action)
          const override = pageKey ? PAGE_ACTION_TYPE_OVERRIDE[pageKey]?.[action.actionType!] : undefined
          const link = resolveRowLink(action.actionType, pageKey)
          const label = override?.text ?? action.text
          return (
            <li key={realIndex} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-foreground">
                {link ? (
                  <Link href={link.href} className="underline underline-offset-4 hover:text-brand">
                    {label}
                  </Link>
                ) : (
                  label
                )}{' '}
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
                // A completed non-recurring action is filtered out of
                // selfReportCommitted above (see that filter's comment) —
                // so by the time an item reaches this branch it's always
                // still open, never done.
                <form action={toggleSprintAction.bind(null, realIndex)} className="shrink-0">
                  <SubmitButton variant="outline" size="sm">
                    Mark done
                  </SubmitButton>
                </form>
              )}
            </li>
          )
        })}
        {selfReportSuggested.map((action) => {
          const effort = estimateActionEffort(action)
          const recurring = isRecurringActionType(action.actionType)
          const override = pageKey ? PAGE_ACTION_TYPE_OVERRIDE[pageKey]?.[action.actionType!] : undefined
          const link = resolveRowLink(action.actionType, pageKey)
          const label = override?.text ?? action.text
          return (
            <li key={action.actionType} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-foreground">
                {link ? (
                  <Link href={link.href} className="underline underline-offset-4 hover:text-brand">
                    {label}
                  </Link>
                ) : (
                  label
                )}{' '}
                <span className="text-xs text-muted-foreground">({effort.points} pts)</span>
              </span>
              <form action={completeCatalogAction} className="shrink-0">
                <input type="hidden" name="text" value={action.text} />
                {action.actionType && <input type="hidden" name="actionType" value={action.actionType} />}
                <SubmitButton variant="outline" size="sm">
                  {recurring ? 'Mark started' : 'Mark done'}
                </SubmitButton>
              </form>
            </li>
          )
        })}
        {autoDetectedRows.map((action) => {
          const progress = lifetimeProgress?.[action.actionType!]
          const override = pageKey ? PAGE_ACTION_TYPE_OVERRIDE[pageKey]?.[action.actionType!] : undefined
          const link = resolveRowLink(action.actionType, pageKey)
          const label = override?.text ?? action.text
          // Weekly (not lifetime) rep count — for recurring types with a
          // real target (getRecurringTargetCount), the badge shows real
          // progress toward it (X / Y). One-time types have no such target;
          // treated as a 1-rep goal so the same "X / Y, green once met"
          // badge still applies instead of a separate done/not-done label.
          // Distinct from `progress` below, which is a lifetime goal passed
          // in per-page (e.g. references: aim for 5 total, ever).
          const weeklyTarget = getRecurringTargetCount(action.actionType) ?? 1
          const weeklyDone = action.completionCount ?? (action.completed ? 1 : 0)
          const achieved = weeklyDone >= weeklyTarget
          return (
            <li key={action.actionType} className="space-y-0.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-foreground">
                  {link ? (
                    <Link href={link.href} className="underline underline-offset-4 hover:text-brand">
                      {label}
                    </Link>
                  ) : (
                    label
                  )}{' '}
                  <span className="text-xs text-muted-foreground">({action.points} pts)</span>
                  {progress && (
                    <span className="ml-1.5 text-xs font-medium text-muted-foreground tabular-nums">
                      · {progress.current} of {progress.target}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums',
                    achieved ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {weeklyDone} / {weeklyTarget}
                </span>
              </div>
              {AUTO_DETECTED_SIGNAL[action.actionType!] && (
                <p className="text-xs text-muted-foreground">{AUTO_DETECTED_SIGNAL[action.actionType!]}</p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
