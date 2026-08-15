'use client'

import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import Link from 'next/link'
import { Trophy, User, Users, BookOpen, Sparkles, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getMyActionScorePersonalBest } from '@/lib/leaderboard/actions'
import {
  ACTION_TYPE_LINK,
  estimateActionEffort,
  getActionWhy,
  getRecurringTargetCount,
  isRecurringActionType,
  navCategoryForActionType,
  splitActionText,
  type NavCategory,
  type SuggestedActionLike,
} from '@/lib/weekly/action-effort'
import type { CommittedAction } from '@/lib/weekly/sprint'
import type { ProfileChecklistItem } from '@/lib/weekly/profile-checklist'
import { CANONICAL_ACTION_LABEL } from '@/lib/weekly/canonical-labels'
import type { SearchStrategyChecklist } from '@/lib/weekly/search-strategy-checklist'
import { CATEGORY_MINIMUM_ENFORCED_FROM_WEEK } from '@/lib/scoring/grade'
import type { WeeklyEngine } from '@/lib/scoring/grade'
import { WeeklyEngineChecklist } from '@/components/dashboard/WeeklyEngineChecklist'
import { cn } from '@/lib/utils'

interface SuggestedAction extends SuggestedActionLike {
  text: string
}

// A single row's shape, regardless of which of the three underlying sources
// it came from (a committed/logged CommittedAction, a not-yet-done
// suggestion, or a profile-checklist item) — one list, one row shape, no
// "committed vs. available" visual split anymore.
interface Row {
  text: string
  points: number
  estimatedMinutes: number
  actionType?: string
  completed: boolean
  recurring: boolean
  completionCount?: number
  priority?: boolean
  // Master Build Script §A5.2 — set when this row was pushed in by a coach's
  // session directives (see pushDirectivesToActionPlan). Drives the "Coach"
  // badge in ActionRow instead of the generic Recurring/Onboarding one, and
  // always renders with the Priority treatment — a coach directive is never
  // just another suggestion.
  fromCoach?: boolean
  // When a completed one-time row was actually finished — lets openRows
  // keep it visible (struck through) through the rest of this week instead
  // of dropping it the instant it's done, then let it drop away once a new
  // week starts. Undefined/null means "no timestamp available," which
  // falls back to the old drop-immediately behavior (see openRows below).
  completedAt?: Date | null
}


// A committed action's identity for de-duplication against the catalog —
// actionType when there is one (canonical Search Actions), otherwise the
// exact text (personalized, LLM-suggested items with no fixed type).
function actionKey(a: { actionType?: string; text: string }): string {
  return a.actionType ?? a.text
}

// Personalize first (lifetime setup — flagged as priority when incomplete,
// see ActionRow), then Connecting, Working and Learning, matching the
// hamburger nav's own section order — "Other" catches personalized
// LLM-suggested items with no fixed actionType to categorize by, and
// deliberately sorts last since it's the least legible bucket. A group with
// no items in it simply isn't rendered.
const GROUP_ORDER: (NavCategory | 'Other')[] = ['Personalize', 'Connecting', 'Working and Learning', 'Other']

// The three sub-pages under the My Profile hub (see
// /dashboard/profile/page.tsx) — each one's items are collapsed into a
// single row with a running point total that counts down as each sub-item
// completes (see consolidateProfileDataRows below), so the Weekly Sprint
// list shows "one page to go fill out" per section instead of scattered
// single-field rows. ANSWER_OPTIONAL_QUESTIONS lives on My Search Strategy
// now, not one of these three, so it's deliberately not in any group here
// — it renders as its own individual row.
const PROFILE_SECTION_GROUPS: { title: string; actionType: string; itemLabels: Record<string, string> }[] = [
  {
    title: 'Complete My Personal Information',
    actionType: 'PROFILE_CONFIRM',
    itemLabels: {
      PROFILE_CONFIRM: 'basics',
      LINKEDIN_PROFILE_ADDED: 'LinkedIn',
      PROFILE_PICTURE_UPLOADED: 'photo',
      INDUSTRY_CONFIRM: 'industry',
      FUNCTION_CONFIRM: 'role',
      SALARY_CONFIRM: 'salary',
    },
  },
  {
    title: 'Complete Screening Questions',
    actionType: 'RED_FLAGS_CONFIRMED',
    itemLabels: {
      WORK_AUTHORIZATION: 'work authorization',
      RED_FLAGS_CONFIRMED: 'deal-breakers and background/drug-test willingness',
    },
  },
  {
    title: 'Set your Search Goals',
    actionType: 'BENEFITS_PRIORITIES_CONFIRMED',
    itemLabels: {
      BENEFITS_PRIORITIES_CONFIRMED: 'minimum comp and the benefits that matter to you',
    },
  },
]

// "basics, LinkedIn, and photo" — Oxford comma only when there are 3+ items,
// no "and" at all for a single item.
function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join('')
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

// The one-time setup questionnaires — personal info, screening, skills
// assessments, search-progress questions — read as one adjacent cluster
// rather than scattered among unrelated one-time items, since they're all
// the same kind of thing: informational forms with no urgency to them.
const ONE_TIME_SETUP_CLUSTER = new Set([
  'PROFILE_CONFIRM', // consolidated "Complete My Personal Information" row
  'RED_FLAGS_CONFIRMED', // consolidated "Complete Screening Questions" row
  'BENEFITS_PRIORITIES_CONFIRMED', // consolidated "Set your Search Goals" row
  'WORKING_STYLE_QUIZ',
  'SKILLS_ASSESSMENT_COMPLETED',
  'ANSWER_OPTIONAL_QUESTIONS',
])

// One-time actions read before recurring ones, and connecting Gmail always
// leads when it's still open — it's the one action that makes every other
// auto-detected action type (applications, interviews, outreach) start
// counting, so it shouldn't get buried under whatever happens to sort
// earlier. Gmail itself is never completed-and-still-present (connecting it
// removes its synthetic row entirely — see allRows above), so it never
// competes with the completed-sinks-last rule below.
// Array.prototype.sort is stable in every engine this app runs on, so rows
// within the same tier (and same completed-state) keep their original
// relative order.
function sortForDisplay(rows: Row[]): Row[] {
  function tier(row: Row): number {
    if (row.actionType === 'GMAIL_CONNECTED' || row.actionType === 'GMAIL_RECONNECTED') return 0
    if (row.actionType && ONE_TIME_SETUP_CLUSTER.has(row.actionType)) return 1
    return row.recurring ? 3 : 2
  }
  // Any row that's done for the week — a completed one-time action, or a
  // recurring action that's already hit its weekly target — reads as
  // "already handled," not "what's left." Done-ness sorts before tier so a
  // done row sinks to the very bottom of its whole section instead of just
  // the bottom of its own tier (a completed setup-cluster item used to
  // still rank above every still-open regular item).
  function doneRank(row: Row): number {
    const targetCount = row.recurring ? getRecurringTargetCount(row.actionType) : null
    const count = row.completionCount ?? (row.completed ? 1 : 0)
    const achieved = row.recurring && targetCount ? count >= targetCount : row.completed
    return achieved ? 1 : 0
  }
  return [...rows].sort((a, b) => doneRank(a) - doneRank(b) || tier(a) - tier(b))
}

// Replaces every row whose actionType is in one of PROFILE_SECTION_GROUPS
// with that group's single combined row (one row per My Profile sub-page,
// not one row overall). Points shown are what's still earnable rather than
// the lifetime total, so the number on screen always answers "how many
// more points is this worth me finishing." A group with nothing at all
// present in `rows` simply isn't rendered — but unlike before, `rows` can
// now include completed-this-week items too (see openRows above), so a
// group whose every sub-item is done this week renders as one struck-through
// row instead of vanishing the instant the last sub-item is answered.
function consolidateProfileDataRows(rows: Row[]): Row[] {
  let remainingRows = rows
  const consolidatedRows: Row[] = []

  for (const group of PROFILE_SECTION_GROUPS) {
    const groupTypes = new Set(Object.keys(group.itemLabels))
    const groupRows = remainingRows.filter((r) => r.actionType && groupTypes.has(r.actionType))
    if (groupRows.length === 0) continue
    remainingRows = remainingRows.filter((r) => !(r.actionType && groupTypes.has(r.actionType)))

    const allDone = groupRows.every((r) => r.completed)
    if (allDone) {
      const mostRecent = groupRows.reduce<Date | null>((latest, r) => {
        if (!r.completedAt) return latest
        return !latest || r.completedAt > latest ? r.completedAt : latest
      }, null)
      consolidatedRows.push({
        text: group.title,
        points: 0,
        estimatedMinutes: 0,
        actionType: group.actionType,
        completed: true,
        recurring: false,
        priority: false,
        completedAt: mostRecent,
      })
      continue
    }

    // Only the sub-items still outstanding — a group that reaches here has
    // at least one incomplete row (see `allDone` above), and any completed
    // sibling shouldn't re-add its label/points to what reads as "what's
    // still left to answer."
    const openGroupRows = groupRows.filter((r) => !r.completed)
    const remainingLabels = openGroupRows.map((r) => group.itemLabels[r.actionType!]).filter(Boolean)

    consolidatedRows.push({
      text: `${group.title} — ${joinWithAnd(remainingLabels)}`,
      points: openGroupRows.reduce((sum, r) => sum + r.points, 0),
      estimatedMinutes: openGroupRows.reduce((sum, r) => sum + r.estimatedMinutes, 0),
      actionType: group.actionType,
      completed: false,
      recurring: false,
      // Real one-time setup — personal info, screening, comp/benefits —
      // but informational, not urgent: nothing else in the app is blocked
      // on any of these, so they don't compete for attention the way
      // Gmail/Calendar connect or a privacy-tier choice do.
      priority: false,
    })
  }

  return [...consolidatedRows, ...remainingRows]
}

function groupByNavCategory<T extends { actionType?: string }>(items: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {
    Personalize: [],
    Connecting: [],
    'Working and Learning': [],
    Other: [],
  }
  for (const item of items) {
    const category = navCategoryForActionType(item.actionType) ?? 'Other'
    groups[category].push(item)
  }
  return groups
}

// One small colored-circle icon per section — Priority gets its own accent
// (orange, matching the row highlight it groups), everything else keys off
// the same NavCategory buckets the hamburger nav and Action Plan boxes use.
const GROUP_ICON: Record<string, { icon: ComponentType<{ className?: string; strokeWidth?: number }>; color: string }> = {
  Priority: { icon: Zap, color: 'bg-orange/15 text-orange' },
  Personalize: { icon: User, color: 'bg-brand/10 text-brand' },
  Connecting: { icon: Users, color: 'bg-success/10 text-success' },
  'Working and Learning': { icon: BookOpen, color: 'bg-light-blue/10 text-light-blue' },
  Other: { icon: Sparkles, color: 'bg-muted text-muted-foreground' },
}

function ActionGroup({ title, children }: { title: string; children: ReactNode }) {
  const iconDef = GROUP_ICON[title]
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {iconDef && (
          <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full', iconDef.color)}>
            <iconDef.icon className="size-3" strokeWidth={2.25} />
          </span>
        )}
        <p className="text-xs font-semibold text-foreground">{title}</p>
      </div>
      {children}
    </div>
  )
}

// Where the real "one Google sign-in grants both scopes" combined route vs.
// the single-service routes live — mirrors GoogleConnectPrompt's own
// startPath logic so a Sprint row and the Network page's connect prompt
// never disagree about which route to send someone to.
function connectHref(hasEmailConnection: boolean, hasCalendarConnection: boolean): string {
  if (!hasEmailConnection && !hasCalendarConnection) return '/api/auth/google-connect/start'
  if (!hasCalendarConnection) return '/api/auth/calendar/start'
  return '/api/auth/gmail/start'
}

// Read-only summary row — marking an action done/started happens on the
// real feature page it links to (see SprintActionCompletion), not here.
// This card's job is to show status and route you to where the work
// actually happens.
function ActionRow({
  text,
  points,
  actionType,
  completed,
  recurring,
  completionCount,
  priority,
  fromCoach,
  hasEmailConnection,
  hasCalendarConnection,
  completedReferencesCount,
}: Row & { hasEmailConnection: boolean; hasCalendarConnection: boolean; completedReferencesCount: number }) {
  let link = actionType ? ACTION_TYPE_LINK[actionType] : undefined
  // "Have a coffee chat or call" only pays out automatically once Calendar
  // is connected — if it isn't, route straight to connecting it instead of
  // the Network page, where the connect prompt is easy to miss.
  if (actionType === 'OUTREACH_CALL' && !hasCalendarConnection) {
    link = { href: connectHref(hasEmailConnection, hasCalendarConnection), label: 'Connect Calendar' }
  }
  // "Action name — why it matters," never the whole sentence underlined —
  // hyperlink only the short label; the reason renders as plain text next to
  // it. See splitActionText/getActionWhy for where each half comes from.
  const { label, why: authoredWhy } = splitActionText(text)
  const why = getActionWhy(actionType, authoredWhy)
  const targetCount = recurring ? getRecurringTargetCount(actionType) : null
  const count = completionCount ?? (completed ? 1 : 0)
  // A recurring row's `completed` flag means "logged at least once ever,"
  // not "hit this week's target" — a row still short of targetCount (e.g. 0
  // of 2) was showing as not-priority and losing its Priority badge
  // even though it's exactly the thing still owed this week. Achieved means
  // count >= targetCount for recurring rows, the plain completed flag for
  // one-time ones.
  const achieved = recurring && targetCount ? count >= targetCount : completed
  const isPriority = !!priority && !achieved
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg px-3 py-2',
        isPriority ? 'border border-orange/40 bg-orange/5' : 'border border-transparent'
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {/* Fixed width so every row's title starts at the same x position,
            regardless of which tag it carries — this used to sit after the
            title (and only some rows had a leading progress badge before
            it), so titles zig-zagged depending on row type. */}
        <span
          className={cn(
            'w-[74px] shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-medium',
            fromCoach ? 'bg-orange/15 text-orange' : 'bg-muted text-muted-foreground'
          )}
        >
          {fromCoach ? 'From coach' : recurring ? 'Recurring' : 'Onboarding'}
        </span>
        <Link
          href={link?.href ?? '/dashboard'}
          className={cn(
            'shrink-0 text-[13px] font-medium hover:underline',
            completed && !recurring ? 'text-muted-foreground line-through' : 'text-foreground'
          )}
        >
          {label}
        </Link>
        {why && <span className="truncate text-xs text-muted-foreground">— {why}</span>}
        {isPriority && (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-orange/20 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-orange uppercase">
            Priority
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {actionType === 'REFERENCE_ADDED' ? (
          // References accumulate over the whole search, not per week — a
          // "this week" badge reset every Monday would misrepresent
          // progress toward the real 5-reference target this row is tracking
          // (see isPriorityActionType). Same pill classes as the "this week"
          // badge below so it reads as the same kind of progress indicator.
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
              completedReferencesCount >= 5 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
            )}
          >
            {completedReferencesCount} / 5
          </span>
        ) : recurring && targetCount ? (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
              count >= targetCount ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
            )}
          >
            {count} / {targetCount} this week
          </span>
        ) : completed && recurring ? (
          <span className="text-xs font-semibold text-brand">✓ this week</span>
        ) : completed && !recurring ? (
          <span className="text-success" aria-hidden>
            ✓
          </span>
        ) : null}
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand tabular-nums">
          {points} pts
        </span>
      </div>
    </div>
  )
}

// PART FOUR §19 — "Weekly Search Sprint gets one line at week's end... No
// ranking inside the Sprint." A self-fetching client component (rather than
// a new prop threaded through this card's caller) so the addition stays
// exactly what the spec asks for: one small line, not a redesign of what
// data this card receives. Fetches once on mount; renders nothing while
// loading or if the candidate has no personal best yet (a first-ever week
// has nothing to compare against).
function PersonalBestLine({ weeklyPoints }: { weeklyPoints: number }) {
  const [best, setBest] = useState<{ bestValue: number; weekStartDate: string } | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    getMyActionScorePersonalBest().then((result) => {
      if (!cancelled) setBest(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!best) return null

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Trophy className="size-3 shrink-0" aria-hidden />
      You&apos;re at <span className="font-medium text-foreground tabular-nums">{weeklyPoints}</span> points this
      week. Your best week yet — <span className="font-medium text-foreground tabular-nums">{best.bestValue}</span>{' '}
      points.
    </p>
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
  onTrack,
  hasEmailConnection,
  hasCalendarConnection,
  profileChecklistItems,
  searchStrategyChecklist,
  completedReferencesCount,
  weekStartDate,
}: {
  actions: CommittedAction[] | null
  suggestedActions: SuggestedAction[]
  weeklySprintsCount: number
  engines: WeeklyEngine[]
  laggingEngines: WeeklyEngine['key'][]
  categoryMinimumsMet: boolean
  weeklyPoints: number
  weeklyPointsTarget: number
  onTrack: boolean
  hasEmailConnection: boolean
  hasCalendarConnection: boolean
  profileChecklistItems: ProfileChecklistItem[]
  searchStrategyChecklist: SearchStrategyChecklist
  completedReferencesCount: number
  weekStartDate: Date
}) {
  // isGoalBonus rows (the one-time welcome/commitment credit) are a
  // historical point award, not a real action to show in this list — their
  // points already flow into weeklyPoints via the props passed in, so
  // dropping them here only removes the stale row, never the credit.
  const realActions = (actions ?? []).filter((a) => !a.isGoalBonus)
  const usedKeys = new Set(realActions.map(actionKey))
  const availableCatalog = suggestedActions.filter((sa) => !usedKeys.has(actionKey(sa)))
  const catalogKeys = new Set(availableCatalog.map(actionKey))

  // "Actions done this week" — every committed action marked complete,
  // one-time or recurring alike. realActions is already scoped to this
  // week's sprint, so this is a simple, honest count with no separate
  // points-by-kind breakdown needed alongside it.
  const actionsDoneCount = realActions.filter((a) => a.completed).length

  // Connecting Gmail is the one action that makes every other auto-detected
  // action type (applications, interviews, outreach) start counting, so
  // until it's connected it's the ONLY priority — everything else waits
  // rather than competing with it for attention. Once it's connected, a
  // small fixed set takes over: networking outreach, references (until 5
  // are in), applying, interim work, learning/skills, and posting, plus
  // Search Strategy setup while it's still incomplete (handled separately
  // below, not through this allowlist, since it isn't a real actionType).
  // #931/#932 Search Plan — learning and posting used to be missing from
  // this set (the other 4 of the Search Plan's 6 areas were already here),
  // so a candidate could go a whole week without either ever surfacing as a
  // priority. Added at the same "always priority once Gmail is connected"
  // level as OUTREACH_MESSAGE/JOB_APPLICATION_SUBMITTED/
  // INTERIM_PROFILE_CREATED, not the conditional-on-a-count shape
  // REFERENCE_ADDED uses — this component has no learning/posting count
  // passed in the way completedReferencesCount is, and DOSSIER_REFERENCE_TARGET
  // (5) has no equivalent target for either area, so there's no real
  // threshold to condition on.
  function isPriorityActionType(actionType: string | undefined): boolean {
    if (!actionType) return false
    if (!hasEmailConnection) return false
    if (actionType === 'OUTREACH_MESSAGE') return true
    if (actionType === 'REFERENCE_ADDED') return completedReferencesCount < 5
    if (actionType === 'JOB_APPLICATION_SUBMITTED') return true
    if (actionType === 'INTERIM_PROFILE_CREATED') return true
    if (actionType === 'LEARNING_MODULE') return true
    if (actionType === 'LEARNING_CERTIFICATE_STARTED') return true
    if (actionType === 'LEARNING_CERTIFICATE') return true
    if (actionType === 'LEARNING_NEW_TOOL_STARTED') return true
    if (actionType === 'LEARNING_NEW_TOOL') return true
    if (actionType === 'LEARNING_SESSION_ATTENDED') return true
    if (actionType === 'LINKEDIN_POST_IDEA') return true
    if (actionType === 'THOUGHT_LEADERSHIP_SHARE') return true
    return false
  }

  // One combined list: every committed/logged action, every not-yet-done
  // suggestion, and every profile-checklist item (a completely separate
  // data source — DB timestamps, not committedActions JSON) — merged and
  // grouped by nav category, with no other distinction drawn between them.
  const allRows: Row[] = [
    ...realActions.map((a) => ({
      // The stored text is a JSON snapshot from whenever this row was
      // completed — it never gets rewritten when a label changes later, so
      // a candidate who logged this action before a copy edit would keep
      // seeing the old wording forever. Prefer the current canonical label
      // whenever this actionType has one; only genuinely personalized rows
      // (no fixed actionType) fall back to their stored text.
      text: CANONICAL_ACTION_LABEL[a.actionType ?? ''] ?? a.text,
      points: a.points,
      estimatedMinutes: a.estimatedMinutes,
      actionType: a.actionType,
      completed: a.completed,
      recurring: a.recurring,
      completionCount: a.completionCount,
      priority: isPriorityActionType(a.actionType) || !!a.fromCoach,
      fromCoach: a.fromCoach,
      completedAt: a.completedAt ? new Date(a.completedAt) : undefined,
    })),
    ...availableCatalog.map((sa) => {
      const effort = estimateActionEffort(sa)
      return {
        text: sa.text,
        points: effort.points,
        estimatedMinutes: effort.minutes,
        actionType: sa.actionType,
        completed: false,
        recurring: isRecurringActionType(sa.actionType),
        priority: isPriorityActionType(sa.actionType),
      }
    }),
    // Excludes anything already represented by a committed or suggested
    // row above — profileChecklistItems is a separate data source (DB
    // timestamps) with no awareness of committedActions/suggestedActions,
    // so without this a type like WORKING_STYLE_QUIZ or PROFILE_CONFIRM
    // could render twice: once with its personalized "why" text, once with
    // this catalog's generic label.
    ...profileChecklistItems
      .filter((item) => !usedKeys.has(item.actionType) && !catalogKeys.has(item.actionType))
      .map((item) => ({
        text: item.label,
        points: item.points,
        estimatedMinutes: estimateActionEffort({ actionType: item.actionType }).minutes,
        actionType: item.actionType,
        completed: item.complete,
        recurring: false,
        priority: isPriorityActionType(item.actionType),
        completedAt: item.completedAt,
      })),
    // Search Strategy's own completeness checklist — a separate data source
    // (CandidateProfile fields, not committedActions/DB timestamps) with its
    // own points scale that never feeds weeklyPoints/weeklyPointsTarget (see
    // search-strategy-checklist.ts doc comment). Only rendered while
    // something's unanswered; disappears once the last field is filled in.
    // Not flagged priority until Gmail is connected — see
    // isPriorityActionType's doc comment above.
    ...(searchStrategyChecklist.incomplete.length > 0
      ? [
          {
            text: `Finish your Search Strategy setup — ${searchStrategyChecklist.incomplete.length} question${searchStrategyChecklist.incomplete.length === 1 ? '' : 's'} left`,
            points: searchStrategyChecklist.totalPointsRemaining,
            estimatedMinutes: searchStrategyChecklist.incomplete.length * 2,
            actionType: 'SEARCH_STRATEGY_CHECKLIST',
            completed: false,
            recurring: false,
            priority: hasEmailConnection,
          },
        ]
      : []),
    // Not a real Search Action — connecting Gmail has its own connect/
    // reconnect UI on the Network page (see profile-checklist.ts's doc
    // comment), so there's no committed/suggested/checklist row for it to
    // ride along on. Injected directly here instead, so it's always visible
    // — and always the sole Priority (see isPriorityActionType) — for as
    // long as the candidate hasn't connected.
    ...(!hasEmailConnection
      ? [
          {
            text: 'Connect Gmail — so we can detect your job search activity automatically',
            points: estimateActionEffort({ actionType: 'GMAIL_CONNECTED' }).points,
            estimatedMinutes: estimateActionEffort({ actionType: 'GMAIL_CONNECTED' }).minutes,
            actionType: 'GMAIL_CONNECTED',
            completed: false,
            recurring: false,
            priority: true,
          },
        ]
      : []),
  ]

  // A completed one-time row stays visible (struck through) through the
  // rest of the week it was completed in — real, current confirmation that
  // it's done — then drops out once a new week starts, since a one-time
  // item completed weeks ago has no relationship to "this week" and would
  // read as stale clutter competing with what's actually still open. Rows
  // with no completedAt (a few profile-checklist items have no discrete
  // timestamp — see profile-checklist.ts) fall back to dropping
  // immediately, the old behavior. Recurring rows are unaffected — those
  // always render "done this week" as a real, current signal.
  const openRows = allRows.filter((r) => {
    if (!r.completed || r.recurring) return true
    if (!r.completedAt) return false
    return r.completedAt.getTime() >= weekStartDate.getTime()
  })

  // Same "hit this week's target" logic ActionRow uses to decide whether a
  // row still gets the Priority badge/border — a recurring row that's
  // already met its weekly count is done for the week even though it stays
  // in openRows (recurring rows never drop out). Without this check such a
  // row still landed in priorityRows below, then rendered with none of the
  // Priority group's visual treatment (ActionRow's own isPriority came out
  // false) — a plain, unbadged row sitting under the "Priority" heading.
  function isAchieved(row: Row): boolean {
    const targetCount = row.recurring ? getRecurringTargetCount(row.actionType) : null
    const count = row.completionCount ?? (row.completed ? 1 : 0)
    return row.recurring && targetCount ? count >= targetCount : row.completed
  }

  // Consolidate before splitting into Priority vs. category groups, not
  // after — otherwise a My Profile sub-item like "Add your LinkedIn
  // profile" shows up here as its own row AND, redundantly, folded into
  // "Complete My Personal Information" under Personalize below.
  const consolidatedOpenRows = consolidateProfileDataRows(openRows)

  // Every still-open, not-yet-achieved high-priority row, regardless of
  // which nav category it belongs to, surfaced as its own group above the
  // rest — so the most important things to do are visible without scanning
  // every section. Deliberately not removed from its own category below: a
  // candidate browsing Connecting should still see "Send a personalized
  // outreach message" there even though it's also called out up top.
  const priorityRows = sortForDisplay(consolidatedOpenRows.filter((r) => r.priority && !isAchieved(r)))

  const groups = groupByNavCategory(consolidatedOpenRows)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Weekly Search Sprint</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div
            className={cn(
              'rounded-lg border-2 p-4',
              onTrack ? 'border-success bg-success/5' : 'border-border bg-muted/40'
            )}
          >
            <p className="text-base font-semibold text-foreground">
              <span className={cn(onTrack ? 'text-success' : 'text-muted-foreground')}>
                {onTrack ? 'On track' : 'Behind pace'}
              </span>
              {': '}
              <span className="text-sm">
                You&apos;ve done <span className="tabular-nums">{actionsDoneCount}</span> action
                {actionsDoneCount === 1 ? '' : 's'} and earned{' '}
                <span className="tabular-nums">{weeklyPoints}</span> of{' '}
                <span className="tabular-nums">{weeklyPointsTarget}</span> points this week
              </span>
            </p>
          </div>
          <PersonalBestLine weeklyPoints={weeklyPoints} />

          {allRows.length > 0 ? (
            <>
              {/* Prompt 83 point 1 — this used to be a sentence explaining
                  that one-time vs. recurring actions count differently.
                  Each row already carries its own "Onboarding"/"Recurring"
                  tag (see ActionRow below), so the mechanic is self-evident
                  without the explanation. */}
              <div id="weekly-actions-list" className="space-y-4 scroll-mt-4">
                {priorityRows.length > 0 && (
                  <ActionGroup title="Priority">
                    {priorityRows.map((row, i) => (
                      <ActionRow
                        key={i}
                        {...row}
                        hasEmailConnection={hasEmailConnection}
                        hasCalendarConnection={hasCalendarConnection}
                        completedReferencesCount={completedReferencesCount}
                      />
                    ))}
                  </ActionGroup>
                )}
                {GROUP_ORDER.map((group) => {
                  const items = sortForDisplay(groups[group])
                  if (items.length === 0) return null
                  return (
                    <ActionGroup key={group} title={group}>
                      {items.map((row, i) => (
                        <ActionRow
                          key={i}
                          {...row}
                          hasEmailConnection={hasEmailConnection}
                          hasCalendarConnection={hasCalendarConnection}
                          completedReferencesCount={completedReferencesCount}
                        />
                      ))}
                    </ActionGroup>
                  )
                })}
              </div>
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
