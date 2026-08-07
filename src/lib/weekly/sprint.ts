import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  estimateActionEffort,
  pointsNeededForA,
  isRecurringActionType,
  navCategoryForActionType,
} from '@/lib/weekly/action-effort'
import { CANONICAL_TASK_MENU, type CanonicalTask } from '@/lib/weekly/task-menu'
import { getVisibilityCalibration } from '@/lib/coach/visibility-calibration'
import { reconcileVerifiedActions } from '@/lib/weekly/action-verification'
import { isGmailTrackingTester } from '@/lib/email-tracking/gmail-oauth'
import { isProfileChecklistActionType } from '@/lib/weekly/profile-checklist'
import { captureServerEvent } from '@/lib/posthog/server'

export interface CommittedAction {
  text: string
  actionType?: string
  points: number
  estimatedMinutes: number
  completed: boolean
  completedAt?: string
  // One-time actions have a real finish line and get a Mark done toggle;
  // recurring actions are an ongoing habit and only ever move from
  // not-started to Started (see isRecurringActionType).
  recurring: boolean
  // How many times this recurring action's real-world behavior has been
  // detected/logged this week — distinct from `completed` (which just
  // gates whether points were awarded at all). Absent/undefined for
  // one-time actions and for recurring actions that have never fired.
  completionCount?: number
  // True only for the first-sprint-only "Completed your welcome &
  // commitment" bonus line — undoing it isn't a real action to revise.
  isGoalBonus?: boolean
  // True only for actions logged mid-week from the "More Actions Available"
  // catalog rather than picked at goal-setting time — kept separate so the
  // two-tier split (locked commitment vs. broader catalog) stays stable even
  // as extra completed actions get added after lock. Absent/false for
  // everything chosen during the original goal-setting flow.
  addedFromCatalog?: boolean
}

export interface SuggestedAction {
  text: string
  actionType?: string
  isAStandard?: boolean
  isStretch?: boolean
}

// Weeks run Monday-Sunday — the Sunday Night Report closes out the week
// that's ending and previews the next one, which starts the following day.
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay() // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diffToMonday)
  return d
}

// The one correct way to compute "which week number is this" — counts only
// WeeklySprint rows strictly BEFORE the given week, then +1. This is
// deliberately NOT `candidate._count.weeklySprints + 1`: that expression is
// only correct in the narrow window before the current week's own row has
// been created (e.g. inside auto-assign-sprint, right before it commits).
// Everywhere else — the dashboard, the Hireability Report, admin pacing,
// coach replies, the Friday gap-nudge email — runs AFTER that row already
// exists, so `_count.weeklySprints` includes the current week too and the
// `+1` overcounts by one, silently bumping every target to next week's ramp
// value for the rest of the week. Counting strictly-prior rows is correct
// regardless of whether this week's row exists yet.
export async function getCandidateWeekNumber(candidateId: string, weekStartDate: Date): Promise<number> {
  const priorWeeks = await prisma.weeklySprint.count({
    where: { candidateId, weekStartDate: { lt: weekStartDate } },
  })
  return priorWeeks + 1
}

// actionType renames that have happened since this week's committedActions
// blob was frozen — a week is only ever rewritten wholesale (weekly
// auto-assign, or a mid-week write from one of the functions below), so an
// old actionType string can sit in the JSON blob for the rest of the week
// after the code that produced it is gone. Mapped here (not deleted) so a
// candidate's in-flight commitment/completion survives the rename instead
// of silently vanishing.
const LEGACY_ACTION_TYPE_ALIASES: Partial<Record<string, string>> = {
  OUTREACH_FOLLOW_UP: 'FOLLOW_UP_NOTE_SENT',
}

// Cleans up a week's committedActions before anything reads or writes it:
// remaps retired actionType strings to their current name, re-derives the
// `recurring` flag from the (possibly just-remapped) actionType rather than
// trusting a value that may have been copied from before a type's
// recurring-ness changed, and collapses duplicate rows for the same
// actionType down to one (a real action type should only ever have one row
// per week — see logCatalogAction/autoCompleteEngagementAction, which merge
// into an existing row rather than pushing a new one; this is the safety
// net for anything that slipped through before that was true, e.g. a
// pre-rename duplicate or a race). Finally, live-checks GMAIL_CONNECTED —
// the OAuth callback pushes its own "Connected your Gmail..." row on
// success, but a still-open suggested/committed GMAIL_CONNECTED row from
// earlier in the week has no other path to ever flip to completed.
async function normalizeCommittedActions(candidateId: string, rawActions: CommittedAction[]): Promise<CommittedAction[]> {
  if (!Array.isArray(rawActions) || rawActions.length === 0) return rawActions

  const remapped = rawActions.map((a) => {
    const actionType = a.actionType ? (LEGACY_ACTION_TYPE_ALIASES[a.actionType] ?? a.actionType) : a.actionType
    return actionType === a.actionType ? a : { ...a, actionType, recurring: isRecurringActionType(actionType) }
  })

  const seen = new Map<string, number>()
  const deduped: CommittedAction[] = []
  for (const action of remapped) {
    if (!action.actionType) {
      deduped.push(action)
      continue
    }
    const existingIndex = seen.get(action.actionType)
    if (existingIndex === undefined) {
      seen.set(action.actionType, deduped.length)
      deduped.push(action)
    } else if (action.completed && !deduped[existingIndex].completed) {
      deduped[existingIndex] = action
    }
  }

  const staleGmailIndex = deduped.findIndex((a) => a.actionType === 'GMAIL_CONNECTED' && !a.completed)
  if (staleGmailIndex !== -1) {
    const [hasEmailConnection, hasCalendarConnection] = await Promise.all([
      prisma.emailConnection.findFirst({ where: { candidateId, disconnectedAt: null } }),
      prisma.calendarConnection.findFirst({ where: { candidateId, disconnectedAt: null } }),
    ])
    if (hasEmailConnection && hasCalendarConnection) {
      deduped[staleGmailIndex] = {
        ...deduped[staleGmailIndex],
        text: 'Connected your Gmail and Calendar so activity counts automatically',
        completed: true,
        completedAt: new Date().toISOString(),
      }
    }
  }

  return deduped
}

// Reconciles verified-action-type completion against real backing data
// before returning, so every consumer of the current week's sprint (grading,
// the dashboard card, the stats page) sees the same ungameable truth without
// each needing its own fix — see reconcileVerifiedActions.
export async function getCurrentWeekSprint(candidateId: string) {
  const weekStartDate = getMondayOfWeek(new Date())
  const sprint = await prisma.weeklySprint.findUnique({
    where: { candidateId_weekStartDate: { candidateId, weekStartDate } },
  })
  if (!sprint) return sprint

  const normalized = await normalizeCommittedActions(candidateId, sprint.committedActions as unknown as CommittedAction[])
  const committedActions = await reconcileVerifiedActions(candidateId, normalized)
  return { ...sprint, committedActions: committedActions as unknown as Prisma.JsonValue }
}

// Market Reality Grade is graded from real weekly follow-through — until a
// candidate has committed to at least one Search Sprint, there's nothing
// to grade yet, so every surface should show "N/A, starting line" instead
// of a computed letter grade.
export async function hasStartedSprint(candidateId: string): Promise<boolean> {
  const count = await prisma.weeklySprint.count({ where: { candidateId } })
  return count > 0
}

// Suggested actions for the upcoming week — flattened from the candidate's
// most recent Hireability Report 7-day plan. (There is no weekly-report
// generator; SundayNightReport is only ever populated by the seed script,
// so this is the only real source of personalized suggestions today.)
async function getPersonalizedSuggestions(candidateId: string): Promise<SuggestedAction[]> {
  const hireabilityReport = await prisma.hireabilityReport.findFirst({
    where: { candidateId },
    orderBy: { generatedAt: 'desc' },
  })
  if (!hireabilityReport) return []

  type RawActionPlanItem = string | { text: string; actionType?: string }
  interface ActionPlanDay {
    day: number
    items: RawActionPlanItem[]
  }
  const actionPlan = hireabilityReport.actionPlan as unknown as ActionPlanDay[]
  const seen = new Set<string>()
  const suggestions: SuggestedAction[] = []
  for (const day of actionPlan) {
    for (const raw of day.items) {
      const item = typeof raw === 'string' ? { text: raw } : raw
      if (seen.has(item.text)) continue
      seen.add(item.text)
      // The LLM occasionally wrote a meta/instructional line about
      // committing to a Search Sprint as if it were a discrete task — that's
      // this platform's own automatic goal-assignment, not a real action
      // with a link or a way to verify it. The prompt now forbids generating
      // new instances of this (see the HARD REQUIREMENT in
      // hireability-report.ts), but this also filters out any
      // already-generated report from before that fix.
      if (!item.actionType && /\bsearch sprint\b/i.test(item.text)) continue
      suggestions.push({ text: item.text, actionType: item.actionType, isAStandard: suggestions.length < 3 })
      if (suggestions.length >= 5) return suggestions
    }
  }
  return suggestions
}

// Personalized suggestions alone (capped at 5) can fall short of later
// weeks' point targets — the ramp reaches 120 points by week 5, which a
// 5-item shortlist can't reliably cover. Tops up with canonical Search
// Actions (skipping any actionType already suggested) until the
// available point total comfortably clears this week's target.
export async function getSuggestedActions(candidateId: string, weekNumber = 1): Promise<SuggestedAction[]> {
  const target = pointsNeededForA(weekNumber)
  const buffer = Math.ceil(target * 1.5)

  // The two work-status confirmations are real, unfinished one-time setup
  // steps (see SalaryConfirmForm / WorkAuthorizationConfirmForm) — surface them until
  // answered regardless of point budget, so they don't get silently
  // skipped just because the rest of the list already covers this week's
  // target.
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: {
      profileConfirmedAt: true,
      industryConfirmedAt: true,
      functionConfirmedAt: true,
      salaryConfirmedAt: true,
      workAuthConfirmedAt: true,
      comfortCheckBonusAt: true,
      email: true,
      jobsAppliedBucket: true,
      interviewsReceivedCount: true,
      networkingLevel: true,
      learnedNewSkillsLevel: true,
      triedPartTimeOrConsulting: true,
      triedExecutiveCoaching: true,
      connectedWithRecruiters: true,
    },
  })

  // getPersonalizedSuggestions flattens a frozen, point-in-time snapshot
  // (the Hireability Report's 7-day plan, or the last Sunday Night Report) —
  // it has no idea the candidate has since confirmed something it suggested.
  // Only SALARY_CONFIRM/WORK_AUTHORIZATION got a live re-check below when
  // they were added; PROFILE_CONFIRM/INDUSTRY_CONFIRM/FUNCTION_CONFIRM never
  // did, so a candidate who confirmed their industry after the report
  // generated it would see "Confirm your industry" stuck in their suggested
  // actions forever. Strip out anything the live profile already confirms,
  // regardless of which snapshot it came from.
  const verifiedDoneTypes: Set<string> = new Set(
    (
      [
        [profile?.profileConfirmedAt, 'PROFILE_CONFIRM'],
        [profile?.industryConfirmedAt, 'INDUSTRY_CONFIRM'],
        [profile?.functionConfirmedAt, 'FUNCTION_CONFIRM'],
        [profile?.salaryConfirmedAt, 'SALARY_CONFIRM'],
        [profile?.workAuthConfirmedAt, 'WORK_AUTHORIZATION'],
      ] as const
    )
      .filter(([confirmedAt]) => !!confirmedAt)
      .map(([, actionType]) => actionType)
  )
  // Every one-time actionType this candidate has ever completed, across ALL
  // past sprints — without this, a completed one-time task (e.g.
  // RESUME_UPDATE) has no persisted-history check anywhere: it could still
  // be sitting in a stale personalized snapshot (see the comment above) or
  // get re-added by the CANONICAL_TASK_MENU top-up below in a later week.
  // Recurring actions are deliberately excluded since they're meant to
  // reset weekly.
  const pastSprints = await prisma.weeklySprint.findMany({
    where: { candidateId },
    select: { committedActions: true },
  })
  const completedOneTimeTypes = new Set<string>()
  for (const past of pastSprints) {
    const pastActions = past.committedActions as unknown as CommittedAction[]
    if (!Array.isArray(pastActions)) continue
    for (const a of pastActions) {
      if (a.actionType && a.completed && !isRecurringActionType(a.actionType)) {
        completedOneTimeTypes.add(a.actionType)
      }
    }
  }

  // Every one-time profile/gate confirmation (WORKING_STYLE_QUIZ,
  // PROFILE_CONFIRM, SALARY_CONFIRM, COMFORT_CHECK_CONFIRM, etc.) now lives
  // entirely on /dashboard/complete-profile — see profile-checklist.ts's
  // doc comment for why. Stripped here regardless of source (a frozen LLM
  // snapshot, the canonical menu) so none of them can reappear as a Sprint
  // suggestion.
  const personalizedRaw = await getPersonalizedSuggestions(candidateId)
  const personalized = personalizedRaw.filter(
    (a) =>
      !a.actionType ||
      (!verifiedDoneTypes.has(a.actionType) &&
        !completedOneTimeTypes.has(a.actionType) &&
        !isProfileChecklistActionType(a.actionType))
  )

  const usedTypes = new Set([...personalized.map((a) => a.actionType).filter(Boolean), ...completedOneTimeTypes])
  const suggestions = [...personalized]
  let total = suggestions.reduce((sum, a) => sum + estimateActionEffort(a).points, 0)

  // Internal testing only — surfaces the Gmail/Calendar connect (see
  // GoogleConnectPrompt) as a real suggested action instead of it only
  // being discoverable on the Network/Find My Job pages. Text names
  // whichever service is actually still missing — each connects
  // separately, so claiming "one click, both" was inaccurate for anyone
  // who'd already connected one of the two.
  if (profile?.email && (await isGmailTrackingTester(profile.email)) && !usedTypes.has('GMAIL_CONNECTED')) {
    const [hasEmailConnection, hasCalendarConnection] = await Promise.all([
      prisma.emailConnection.findFirst({ where: { candidateId, disconnectedAt: null } }),
      prisma.calendarConnection.findFirst({ where: { candidateId, disconnectedAt: null } }),
    ])
    if (!hasEmailConnection || !hasCalendarConnection) {
      const text =
        !hasEmailConnection && !hasCalendarConnection
          ? 'Connect your Gmail and Calendar'
          : !hasEmailConnection
            ? 'Connect your Gmail'
            : 'Connect your Calendar'
      suggestions.push({ text, actionType: 'GMAIL_CONNECTED' })
      usedTypes.add('GMAIL_CONNECTED')
      total += estimateActionEffort({ actionType: 'GMAIL_CONNECTED' }).points
    }
  }

  // Says they like being visible (content, networking) but recent weeks
  // show none of it — surface the specific gap as its own suggestion
  // rather than leaving it implicit in the canonical menu below.
  const visibilityCalibration = await getVisibilityCalibration(candidateId)
  if (visibilityCalibration.gap === 'wants_more_visibility') {
    if (
      !usedTypes.has('LINKEDIN_POST_IDEA') &&
      (visibilityCalibration.contentComfortLevel ?? 0) >= 60 &&
      visibilityCalibration.contentActionsCompletedRecently === 0
    ) {
      suggestions.push({
        text: 'Publish a LinkedIn post',
        actionType: 'LINKEDIN_POST_IDEA',
      })
      usedTypes.add('LINKEDIN_POST_IDEA')
      total += estimateActionEffort({ actionType: 'LINKEDIN_POST_IDEA' }).points
    }
    if (!usedTypes.has('OUTREACH_MESSAGE') && visibilityCalibration.networkingLevel === 2) {
      suggestions.push({
        text: 'Send a personalized outreach message',
        actionType: 'OUTREACH_MESSAGE',
      })
      usedTypes.add('OUTREACH_MESSAGE')
      total += estimateActionEffort({ actionType: 'OUTREACH_MESSAGE' }).points
    }
  }

  // Week 1 specifically: don't surface recurring, open-ended Search Actions
  // (outreach, engagement, posting) until every one-time setup/confirm
  // action is done. A brand-new candidate should nail down profile/level/
  // comfort-check data up front — the exact inputs job matching and grading
  // depend on — rather than that being left to inference while they're
  // already off sending outreach messages. Once no one-time suggestion
  // remains outstanding, recurring ones flow through normally, even in
  // week 1.
  const suppressRecurringForWeek1 = weekNumber === 1

  // Round-robins the canonical menu across nav categories (Building /
  // Connecting / Learning & Working) instead of walking it top-to-bottom —
  // Outreach+Engage (all Connecting) sit first in the flat list and are
  // dense enough in points that a plain top-to-bottom walk exhausts the
  // buffer before Building/Learning items ever get a turn, starving the
  // Sprint's Building section out almost every week from week 2 on. One
  // item per category per round guarantees each gets a chance early.
  const categoryQueues = new Map<string, CanonicalTask[]>()
  for (const task of CANONICAL_TASK_MENU) {
    const category = navCategoryForActionType(task.actionType) ?? 'Other'
    if (!categoryQueues.has(category)) categoryQueues.set(category, [])
    categoryQueues.get(category)!.push(task)
  }
  const queues = [...categoryQueues.values()]
  let anyLeft = true
  while (anyLeft && total < buffer) {
    anyLeft = false
    for (const queue of queues) {
      if (total >= buffer) break
      const task = queue.shift()
      if (!task) continue
      anyLeft = true
      if (task.actionType && usedTypes.has(task.actionType)) continue
      if (suppressRecurringForWeek1 && isRecurringActionType(task.actionType)) continue
      suggestions.push({ text: task.text, actionType: task.actionType })
      if (task.actionType) usedTypes.add(task.actionType)
      total += estimateActionEffort(task).points
    }
  }

  if (suppressRecurringForWeek1 && suggestions.some((s) => !isRecurringActionType(s.actionType))) {
    return suggestions.filter((s) => !isRecurringActionType(s.actionType))
  }

  return suggestions
}

// The 5 points promised on the post-signup welcome/payoff page (see
// /onboarding/welcome) — awarded once, folded into whichever sprint turns
// out to be the candidate's first, never repeated in later weeks.
export const INTRO_WELCOME_BONUS_POINTS = 5

export async function commitWeeklySprint(
  candidateId: string,
  actions: { text: string; actionType?: string; points: number; estimatedMinutes: number }[],
  autoAssigned = false
) {
  const weekStartDate = getMondayOfWeek(new Date())

  // Only ever true for the candidate's first sprint — checked against every
  // OTHER week so re-submitting goals within the same week's edit window
  // (an update, not a create) still counts as "first" and doesn't lose the
  // bonus.
  const [priorWeeksCount, profile] = await Promise.all([
    prisma.weeklySprint.count({ where: { candidateId, weekStartDate: { not: weekStartDate } } }),
    prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { introCommittedAt: true } }),
  ])
  const includeWelcomeBonus = priorWeeksCount === 0 && !!profile?.introCommittedAt

  const committedActions: CommittedAction[] = [
    ...(includeWelcomeBonus
      ? [
          {
            text: 'Completed your welcome & commitment',
            points: INTRO_WELCOME_BONUS_POINTS,
            estimatedMinutes: 0,
            completed: true,
            completedAt: new Date().toISOString(),
            recurring: false,
            isGoalBonus: true,
          },
        ]
      : []),
    ...actions.map((a) => ({
      text: a.text,
      actionType: a.actionType,
      points: a.points,
      estimatedMinutes: a.estimatedMinutes,
      completed: false,
      recurring: isRecurringActionType(a.actionType),
    })),
  ]

  return prisma.weeklySprint.upsert({
    where: { candidateId_weekStartDate: { candidateId, weekStartDate } },
    create: {
      candidateId,
      weekStartDate,
      committedActions: committedActions as unknown as Prisma.InputJsonValue,
      autoAssigned,
    },
    update: { committedActions: committedActions as unknown as Prisma.InputJsonValue, autoAssigned },
  })
}

// Called once, right when a brand-new candidate commits on the Welcome page
// (see submitIntroCommitment) — without this, their first Weekly Search
// Sprint stays genuinely empty ("you haven't set goals yet", 0 of 60 points)
// until they either visit goal-setting themselves or the Monday auto-assign
// cron runs, which could be days away. Reuses the same suggestion engine and
// commit path as both of those flows, just triggered immediately. No-ops if
// a sprint already exists (idempotent — safe even if called twice).
export async function autoPopulateFirstSprint(candidateId: string) {
  if (await hasStartedSprint(candidateId)) return null

  const target = pointsNeededForA(1)
  const remainingBudget = Math.max(0, target - INTRO_WELCOME_BONUS_POINTS)

  const suggestions = await getSuggestedActions(candidateId, 1)
  const withEffort = suggestions.map((s) => ({
    text: s.text,
    actionType: s.actionType,
    recurring: isRecurringActionType(s.actionType),
    ...estimateActionEffort(s),
  }))

  // A first-ever sprint should mostly be discrete, finishable setup tasks —
  // a candidate with no history yet hasn't built any ongoing habits, so
  // one-time actions (a real finish line, a Mark done toggle) go first;
  // recurring ones only fill in if there's budget left over.
  const oneTime = withEffort.filter((a) => !a.recurring)
  const recurring = withEffort.filter((a) => a.recurring)

  const actions: { text: string; actionType?: string; points: number; estimatedMinutes: number }[] = []
  let total = 0
  for (const candidate of [...oneTime, ...recurring]) {
    if (total >= remainingBudget) break
    actions.push({
      text: candidate.text,
      actionType: candidate.actionType,
      points: candidate.points,
      estimatedMinutes: candidate.minutes,
    })
    total += candidate.points
  }

  const sprint = await commitWeeklySprint(candidateId, actions, true)
  captureServerEvent(candidateId, 'weekly_sprint_submitted', {
    weekNumber: 1,
    actionCount: actions.length,
    committedPoints: total + INTRO_WELCOME_BONUS_POINTS,
    autoPopulated: true,
  })
  return sprint
}

// Auto-verifies a recurring "Engage" action the moment the real behavior
// happens (e.g. actually posting to Community) instead of waiting for a
// self-report click — same philosophy as reconcileVerifiedActions, but for
// recurring catalog actions that don't fit that helper's one-time
// confirmation shape. No-ops if the candidate hasn't set this week's goals
// yet (no sprint to log against). Recurring actions still award `points`
// only once per week no matter how many times this fires — but each firing
// increments completionCount, so the dashboard can show real progress
// ("2 of 3 this week") instead of a flat done/not-done state.
export async function autoCompleteEngagementAction(
  candidateId: string,
  action: { actionType: string; text: string; points: number; estimatedMinutes: number }
) {
  const sprint = await getCurrentWeekSprint(candidateId)
  if (!sprint) return

  const actions = sprint.committedActions as unknown as CommittedAction[]
  const existing = actions.find((a) => a.actionType === action.actionType)

  if (existing) {
    existing.completionCount = (existing.completionCount ?? (existing.completed ? 1 : 0)) + 1
    existing.completed = true
    existing.completedAt = new Date().toISOString()
  } else {
    actions.push({
      text: action.text,
      actionType: action.actionType,
      points: action.points,
      estimatedMinutes: action.estimatedMinutes,
      completed: true,
      completedAt: new Date().toISOString(),
      recurring: isRecurringActionType(action.actionType),
      completionCount: 1,
      addedFromCatalog: true,
    })
  }

  await prisma.weeklySprint.update({
    where: { id: sprint.id },
    data: { committedActions: actions as unknown as Prisma.InputJsonValue },
  })
}

export async function toggleSprintActionCompletion(candidateId: string, actionIndex: number) {
  const sprint = await getCurrentWeekSprint(candidateId)
  if (!sprint) return

  const actions = sprint.committedActions as unknown as CommittedAction[]
  const target = actions[actionIndex]
  if (!target) return

  if (target.recurring) {
    // One-way: recurring actions move from not-started to Started and stay
    // there — there's no finish line to un-check.
    if (target.completed) return
    target.completed = true
    target.completedAt = new Date().toISOString()
  } else {
    target.completed = !target.completed
    target.completedAt = target.completed ? new Date().toISOString() : undefined
  }

  await prisma.weeklySprint.update({
    where: { id: sprint.id },
    data: { committedActions: actions as unknown as Prisma.InputJsonValue },
  })
}

// Logs an action picked from "More Actions Available" — the broader catalog
// shown alongside the locked commitment (Prompt 45 §6). Unlike a committed
// action, there's no separate row to toggle yet, so this both adds the row
// and marks it done/started in one step: there's nothing else you'd do with
// a catalog item except log that you did it. If a row for this actionType
// already exists this week (e.g. a still-open suggested/committed row, or a
// repeat catalog log), updates that row in place instead of pushing a
// duplicate — actionType is meant to be at most one row per week; see
// normalizeCommittedActions for the cleanup pass covering anything that
// slipped through before this was true.
export async function logCatalogAction(
  candidateId: string,
  action: { text: string; actionType?: string; points: number; estimatedMinutes: number; recurring: boolean }
) {
  const sprint = await getCurrentWeekSprint(candidateId)
  if (!sprint) return

  const actions = sprint.committedActions as unknown as CommittedAction[]
  const existing = action.actionType ? actions.find((a) => a.actionType === action.actionType) : undefined

  if (existing) {
    existing.text = action.text
    existing.points = action.points
    existing.estimatedMinutes = action.estimatedMinutes
    existing.completionCount = (existing.completionCount ?? (existing.completed ? 1 : 0)) + 1
    existing.completed = true
    existing.completedAt = new Date().toISOString()
    await prisma.weeklySprint.update({
      where: { id: sprint.id },
      data: { committedActions: actions as unknown as Prisma.InputJsonValue },
    })
    return
  }

  actions.push({
    text: action.text,
    actionType: action.actionType,
    points: action.points,
    estimatedMinutes: action.estimatedMinutes,
    completed: true,
    completedAt: new Date().toISOString(),
    recurring: action.recurring,
    completionCount: 1,
    addedFromCatalog: true,
  })

  await prisma.weeklySprint.update({
    where: { id: sprint.id },
    data: { committedActions: actions as unknown as Prisma.InputJsonValue },
  })
}
