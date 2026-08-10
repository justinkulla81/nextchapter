'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ACTION_TYPE_LINK,
  estimateActionEffort,
  formatMinutes,
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
}

// No field tracks a literal "date last employed" (see the same tradeoff
// documented in directness-level.ts) — weekNumber (weeklySprintsCount) is
// this codebase's established stand-in for how long a search has been going.
// 13 weeks ~= 3 months, the same cutover directness-level.ts uses for its
// most direct "reckoning" tier.
const LONG_SEARCH_WEEK_THRESHOLD = 13

// A committed action's identity for de-duplication against the catalog —
// actionType when there is one (canonical Search Actions), otherwise the
// exact text (personalized, LLM-suggested items with no fixed type).
function actionKey(a: { actionType?: string; text: string }): string {
  return a.actionType ?? a.text
}

// Personalize first (lifetime setup — flagged as priority when incomplete,
// see ActionRow), then Building, Connecting, Learning & Working, matching
// the hamburger nav's own section order — "Other" catches personalized
// LLM-suggested items with no fixed actionType to categorize by, and
// deliberately sorts last since it's the least legible bucket. A group with
// no items in it simply isn't rendered.
const GROUP_ORDER: (NavCategory | 'Other')[] = ['Personalize', 'Building', 'Connecting', 'Learning & Working', 'Other']

// The "confirm your data" cluster of Personalize items — all six live on
// the same /dashboard/profile page (see ACTION_TYPE_LINK), so listing them
// as six separate Sprint rows read as scattered busywork rather than "one
// page to go fill out." Collapsed into a single row with a running point
// total that counts down as each sub-item completes (see
// consolidateProfileDataRows below).
const PROFILE_DATA_ACTION_TYPES = new Set([
  'PROFILE_CONFIRM',
  'INDUSTRY_CONFIRM',
  'FUNCTION_CONFIRM',
  'SALARY_CONFIRM',
  'WORK_AUTHORIZATION',
  'ANSWER_OPTIONAL_QUESTIONS',
  'PROFILE_PICTURE_UPLOADED',
  'LINKEDIN_PROFILE_ADDED',
])

// Within a group, high-priority rows read first, then everything else —
// a completed one-time row never reaches this function at all (see
// openRows below, which drops those before grouping/sorting ever runs), so
// there's no "completed rows last" tier to account for here anymore.
// Array.prototype.sort is stable in every engine this app runs on, so rows
// within the same tier keep their original relative order.
function sortForDisplay(rows: Row[]): Row[] {
  function tier(row: Row): number {
    return row.priority ? 0 : 1
  }
  return [...rows].sort((a, b) => tier(a) - tier(b))
}

// Replaces every row whose actionType is in PROFILE_DATA_ACTION_TYPES with
// one combined row. Points shown are what's still earnable (0 once every
// sub-item is done) rather than the lifetime total, so the number on
// screen always answers "how many more points is this worth me finishing."
function consolidateProfileDataRows(rows: Row[]): Row[] {
  const profileDataRows = rows.filter((r) => r.actionType && PROFILE_DATA_ACTION_TYPES.has(r.actionType))
  if (profileDataRows.length === 0) return rows

  const otherRows = rows.filter((r) => !(r.actionType && PROFILE_DATA_ACTION_TYPES.has(r.actionType)))
  const remaining = profileDataRows.filter((r) => !r.completed)
  const allDone = remaining.length === 0

  const consolidated: Row = {
    text:
      'Complete your profile to personalize coaching, jobs and skills — confirms your basics, industry, role, salary, and work authorization',
    points: remaining.reduce((sum, r) => sum + r.points, 0),
    estimatedMinutes: remaining.reduce((sum, r) => sum + r.estimatedMinutes, 0),
    actionType: 'PROFILE_CONFIRM',
    completed: allDone,
    recurring: false,
    priority: true,
  }

  return [consolidated, ...otherRows]
}

function groupByNavCategory<T extends { actionType?: string }>(items: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {
    Personalize: [],
    Building: [],
    Connecting: [],
    'Learning & Working': [],
    Other: [],
  }
  for (const item of items) {
    const category = navCategoryForActionType(item.actionType) ?? 'Other'
    groups[category].push(item)
  }
  return groups
}

function isPersonalizeType(actionType: string | undefined): boolean {
  return navCategoryForActionType(actionType) === 'Personalize'
}

function ActionGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-foreground">{title}</p>
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
  estimatedMinutes,
  actionType,
  completed,
  recurring,
  completionCount,
  priority,
  hasEmailConnection,
  hasCalendarConnection,
}: Row & { hasEmailConnection: boolean; hasCalendarConnection: boolean }) {
  let link = actionType ? ACTION_TYPE_LINK[actionType] : undefined
  // "Have a coffee chat or call" only pays out automatically once Calendar
  // is connected — if it isn't, route straight to connecting it instead of
  // the Network page, where the connect prompt is easy to miss.
  if (actionType === 'OUTREACH_CALL' && !hasCalendarConnection) {
    link = { href: connectHref(hasEmailConnection, hasCalendarConnection), label: 'Connect Calendar' }
  }
  const isPriority = !!priority && !completed
  // "Action name — why it matters," never the whole sentence underlined —
  // hyperlink only the short label; the reason renders as plain text next to
  // it. See splitActionText/getActionWhy for where each half comes from.
  const { label, why: authoredWhy } = splitActionText(text)
  const why = getActionWhy(actionType, authoredWhy)
  const targetCount = recurring ? getRecurringTargetCount(actionType) : null
  const count = completionCount ?? (completed ? 1 : 0)
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border px-3 py-2',
        isPriority ? 'border-orange/40 bg-orange/5' : 'border-border bg-off-white'
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {recurring && targetCount ? (
          <span
            className={cn(
              'shrink-0 rounded-full text-xs font-semibold tabular-nums',
              count >= targetCount ? 'bg-success/10 px-2 py-0.5 text-success' : 'text-muted-foreground'
            )}
          >
            {count} of {targetCount} this week
          </span>
        ) : completed && recurring ? (
          <span className="shrink-0 text-xs font-semibold text-brand tabular-nums">✓ {points} pts this week</span>
        ) : completed && !recurring ? (
          <span className="shrink-0 text-success" aria-hidden>
            ✓
          </span>
        ) : null}
        <Link
          href={link?.href ?? '/dashboard'}
          className={cn(
            'shrink-0 text-sm hover:underline',
            completed && !recurring ? 'text-muted-foreground line-through' : 'text-foreground'
          )}
        >
          {label}
        </Link>
        {why && <span className="truncate text-xs text-muted-foreground">— {why}</span>}
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {recurring ? 'Recurring' : 'One-time'}
        </span>
        {isPriority && (
          <span className="shrink-0 rounded-full bg-orange/20 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-orange uppercase">
            High Priority
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-xs text-muted-foreground tabular-nums">{formatMinutes(estimatedMinutes)}</span>
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
  onTrack,
  hasEmailConnection,
  hasCalendarConnection,
  profileChecklistItems,
  searchStrategyChecklist,
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

  // Every incomplete Personalize item (connecting Gmail/Calendar, any undone
  // profile/gate confirm) is flagged as a high-priority action, same visual
  // treatment as the hamburger nav's High Priority badge — foundational
  // setup that unlocks or improves everything else. Getting an interim job
  // joins that flag, but only once the search has run long enough that
  // bridging the gap becomes the priority (see LONG_SEARCH_WEEK_THRESHOLD).
  // A few Personalize items are deliberately excluded — real one-time
  // setup, but not foundational the way the others are, so they shouldn't
  // compete for attention with things that unlock the rest of the app:
  // the Interview Prep Comfort Check, and the three content/marketplace
  // unlock gates (work samples, Interim/Gig Directory, LinkedIn post
  // generator) — each is a nice-to-have unlock, not a blocker for anything
  // else.
  const DEPRIORITIZED_PERSONALIZE_TYPES = new Set([
    'COMFORT_CHECK_CONFIRM',
    'WORK_SAMPLE_TYPE_CONFIRMED',
    'GIG_DIRECTORY_UNLOCK',
    'LINKEDIN_UNLOCK',
  ])
  // The core, always-available job-search actions — applying, networking
  // outreach, adding contacts, and lining up references — carry real weekly
  // point value and are never blocked on anything else being done first, so
  // they get the same priority visual as foundational Personalize setup.
  const CORE_SEARCH_ACTION_TYPES = new Set([
    'JOB_APPLICATION_SUBMITTED',
    'OUTREACH_MESSAGE',
    'NETWORKING_LIST',
    'REFERENCE_ADDED',
  ])
  function isPriorityActionType(actionType: string | undefined): boolean {
    if (!actionType) return false
    if (DEPRIORITIZED_PERSONALIZE_TYPES.has(actionType)) return false
    if (isPersonalizeType(actionType)) return true
    if (CORE_SEARCH_ACTION_TYPES.has(actionType)) return true
    if (actionType === 'INTERIM_PROFILE_CREATED') return weeklySprintsCount >= LONG_SEARCH_WEEK_THRESHOLD
    return false
  }

  // One combined list: every committed/logged action, every not-yet-done
  // suggestion, and every profile-checklist item (a completely separate
  // data source — DB timestamps, not committedActions JSON) — merged and
  // grouped by nav category, with no other distinction drawn between them.
  const allRows: Row[] = [
    ...realActions.map((a) => ({
      text: a.text,
      points: a.points,
      estimatedMinutes: a.estimatedMinutes,
      actionType: a.actionType,
      completed: a.completed,
      recurring: a.recurring,
      completionCount: a.completionCount,
      priority: isPriorityActionType(a.actionType),
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
      })),
    // Search Strategy's own completeness checklist — a separate data source
    // (CandidateProfile fields, not committedActions/DB timestamps) with its
    // own points scale that never feeds weeklyPoints/weeklyPointsTarget (see
    // search-strategy-checklist.ts doc comment). Only rendered while
    // something's unanswered; disappears once the last field is filled in.
    ...(searchStrategyChecklist.incomplete.length > 0
      ? [
          {
            text: `Finish your Search Strategy setup — ${searchStrategyChecklist.incomplete.length} question${searchStrategyChecklist.incomplete.length === 1 ? '' : 's'} left`,
            points: searchStrategyChecklist.totalPointsRemaining,
            estimatedMinutes: searchStrategyChecklist.incomplete.length * 2,
            actionType: 'SEARCH_STRATEGY_CHECKLIST',
            completed: false,
            recurring: false,
            priority: true,
          },
        ]
      : []),
  ]

  // A completed one-time row drops out of the list immediately — same
  // rule SprintActionCompletion already applies, and for the same reason:
  // a struck-through row that's already done isn't "what's left to do,"
  // it's stale clutter, and it read as confusing/wrong at the start of a
  // fresh week (a one-time item completed weeks ago has no relationship to
  // "this week" and shouldn't visually compete with what's actually still
  // open). Recurring rows are unaffected — those still render "done this
  // week" as a real, current signal, not a stale leftover.
  const openRows = allRows.filter((r) => !(r.completed && !r.recurring))

  // Every still-open high-priority row, regardless of which nav category
  // it belongs to, surfaced as its own group above the rest — so the most
  // important things to do are visible without scanning every section.
  // Deliberately not removed from its own category below: a candidate
  // browsing Connecting should still see "Send a personalized outreach
  // message" there even though it's also called out up top.
  const priorityRows = sortForDisplay(openRows.filter((r) => r.priority))

  const groups = groupByNavCategory(consolidateProfileDataRows(openRows))

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
            <p className="text-lg font-semibold text-foreground">
              <span className={cn('text-base font-bold', onTrack ? 'text-success' : 'text-muted-foreground')}>
                {onTrack ? 'On track' : 'Behind pace'}
              </span>
              {' — '}
              {allRows.length > 0 ? (
                <a href="#weekly-actions-list" className="underline underline-offset-4 hover:text-primary">
                  <span className="tabular-nums">{weeklyPoints}</span> of{' '}
                  <span className="tabular-nums">{weeklyPointsTarget}</span> points this week ·{' '}
                  <span className="tabular-nums">{actionsDoneCount}</span> action
                  {actionsDoneCount === 1 ? '' : 's'} done
                </a>
              ) : (
                <>
                  <span className="tabular-nums">{weeklyPoints}</span> of{' '}
                  <span className="tabular-nums">{weeklyPointsTarget}</span> points this week ·{' '}
                  <span className="tabular-nums">{actionsDoneCount}</span> action
                  {actionsDoneCount === 1 ? '' : 's'} done
                </>
              )}
            </p>
          </div>

          {allRows.length > 0 ? (
            <>
              <p className="text-xs text-muted-foreground">
                One-time actions count once, ever. Recurring actions count once per week — do them
                again next week to earn those points again.
              </p>
              <div id="weekly-actions-list" className="space-y-4 scroll-mt-4">
                {priorityRows.length > 0 && (
                  <ActionGroup title="Priority">
                    {priorityRows.map((row, i) => (
                      <ActionRow
                        key={i}
                        {...row}
                        hasEmailConnection={hasEmailConnection}
                        hasCalendarConnection={hasCalendarConnection}
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
