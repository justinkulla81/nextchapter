import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { estimateActionEffort, pointsNeededForA, isRecurringActionType } from '@/lib/weekly/action-effort'
import { CANONICAL_TASK_MENU } from '@/lib/weekly/task-menu'
import { reconcileVerifiedActions } from '@/lib/weekly/action-verification'

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
  // True only for auto-injected bonus lines ("Defined this week's goal",
  // and — first sprint only — "Completed your welcome & commitment") —
  // undoing them isn't a real action to revise, so they're only ever
  // editable while the goal-setting window is still open (see
  // SuccessSprintCard).
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

// getMondayOfWeek(now) resolves to the right target on every day except
// Sunday — Sunday belongs to the week that started the PRECEDING Monday, so
// it would return LAST Monday. The Sun 12:01am-Mon 12:01pm PT goal-setting
// window always concerns the week starting the very NEXT Monday, so on a
// Sunday specifically this bumps the reference forward a day first. Every
// caller that gates or writes the goal-setting commitment must use this,
// not getMondayOfWeek directly — otherwise a Sunday submission silently
// lands on the outgoing week's record instead of creating the new one.
export function getGoalSettingWeekStart(reference: Date = new Date()): Date {
  const isSunday = new Date(reference).getUTCDay() === 0
  const adjusted = isSunday ? new Date(reference.getTime() + 24 * 60 * 60 * 1000) : reference
  return getMondayOfWeek(adjusted)
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

  const committedActions = await reconcileVerifiedActions(
    candidateId,
    sprint.committedActions as unknown as CommittedAction[]
  )
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

// Suggested actions for the upcoming week — pulled from the most recent
// Sunday Night Report if one exists, otherwise falls back to flattening the
// existing Hireability Report's 7-day plan (Week 1, before any weekly
// report has run).
async function getPersonalizedSuggestions(candidateId: string): Promise<SuggestedAction[]> {
  const latestReport = await prisma.sundayNightReport.findFirst({
    where: { candidateId },
    orderBy: { generatedAt: 'desc' },
  })
  if (latestReport) {
    return latestReport.suggestedActionPlan as unknown as SuggestedAction[]
  }

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
  const personalized = await getPersonalizedSuggestions(candidateId)
  const target = pointsNeededForA(weekNumber)
  const buffer = Math.ceil(target * 1.5)

  const usedTypes = new Set(personalized.map((a) => a.actionType).filter(Boolean))
  const suggestions = [...personalized]
  let total = suggestions.reduce((sum, a) => sum + estimateActionEffort(a).points, 0)

  // The two work-status confirmations are real, unfinished one-time setup
  // steps (see SalaryAuthorizationConfirmForm) — surface them until
  // answered regardless of point budget, so they don't get silently
  // skipped just because the rest of the list already covers this week's
  // target.
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: {
      salaryConfirmedAt: true,
      workAuthConfirmedAt: true,
      jobsAppliedBucket: true,
      interviewsReceivedCount: true,
      networkingLevel: true,
      learnedNewSkillsLevel: true,
      triedPartTimeOrConsulting: true,
      triedExecutiveCoaching: true,
      connectedWithRecruiters: true,
    },
  })
  if (profile && !profile.salaryConfirmedAt && !usedTypes.has('SALARY_CONFIRM')) {
    suggestions.push({ text: 'Confirm your last salary', actionType: 'SALARY_CONFIRM' })
    usedTypes.add('SALARY_CONFIRM')
    total += estimateActionEffort({ actionType: 'SALARY_CONFIRM' }).points
  }
  if (profile && !profile.workAuthConfirmedAt && !usedTypes.has('WORK_AUTHORIZATION')) {
    suggestions.push({ text: 'Confirm your work authorization status', actionType: 'WORK_AUTHORIZATION' })
    usedTypes.add('WORK_AUTHORIZATION')
    total += estimateActionEffort({ actionType: 'WORK_AUTHORIZATION' }).points
  }

  // "How I Work Best" is a genuinely optional dashboard action, never part
  // of mandatory onboarding — but it's valuable enough to nudge hard on,
  // so unlike the two confirmations above (appended), this goes to the
  // very front of the list, ahead of anything personalized, whenever it's
  // still unfinished.
  if (!usedTypes.has('WORKING_STYLE_QUIZ')) {
    const hasCompletedWorkStyleQuiz = (await prisma.candidateAssessmentResponse.count({ where: { candidateId } })) > 0
    if (!hasCompletedWorkStyleQuiz) {
      suggestions.unshift({ text: 'Take the How I Work Best assessment', actionType: 'WORKING_STYLE_QUIZ' })
      usedTypes.add('WORKING_STYLE_QUIZ')
      total += estimateActionEffort({ actionType: 'WORKING_STYLE_QUIZ' }).points
    }
  }

  const hasUnansweredOptionalQuestion =
    profile &&
    [
      profile.jobsAppliedBucket,
      profile.interviewsReceivedCount,
      profile.networkingLevel,
      profile.learnedNewSkillsLevel,
      profile.triedPartTimeOrConsulting,
      profile.triedExecutiveCoaching,
      profile.connectedWithRecruiters,
    ].some((f) => f === null)
  if (hasUnansweredOptionalQuestion && !usedTypes.has('ANSWER_OPTIONAL_QUESTIONS')) {
    suggestions.push({
      text: 'Answer the remaining optional questions about your job search — improves your Detail-Orientedness score',
      actionType: 'ANSWER_OPTIONAL_QUESTIONS',
    })
    usedTypes.add('ANSWER_OPTIONAL_QUESTIONS')
    total += estimateActionEffort({ actionType: 'ANSWER_OPTIONAL_QUESTIONS' }).points
  }

  for (const task of CANONICAL_TASK_MENU) {
    if (total >= buffer) break
    if (task.actionType && usedTypes.has(task.actionType)) continue
    suggestions.push({ text: task.text, actionType: task.actionType })
    if (task.actionType) usedTypes.add(task.actionType)
    total += estimateActionEffort(task).points
  }

  return suggestions
}

// A small flat bonus just for defining a goal at all — recognized as its
// own line item (not silently folded into the total) since committing to a
// plan is itself a good sign, independent of what's in the plan.
export const GOAL_DEFINED_BONUS_POINTS = 5

// The 5 points promised on the post-signup welcome/payoff page (see
// /onboarding/welcome) — awarded once, folded into whichever sprint turns
// out to be the candidate's first, never repeated in later weeks.
export const INTRO_WELCOME_BONUS_POINTS = 5

export async function commitWeeklySprint(
  candidateId: string,
  actions: { text: string; actionType?: string; points: number; estimatedMinutes: number }[],
  autoAssigned = false
) {
  const weekStartDate = getGoalSettingWeekStart()

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
    {
      text: "Defined this week's goal",
      points: GOAL_DEFINED_BONUS_POINTS,
      estimatedMinutes: 0,
      completed: true,
      completedAt: new Date().toISOString(),
      recurring: false,
      isGoalBonus: true,
    },
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

// Auto-verifies a recurring "Engage" action the moment the real behavior
// happens (e.g. actually posting to Community) instead of waiting for a
// self-report click — same philosophy as reconcileVerifiedActions, but for
// recurring catalog actions that don't fit that helper's one-time
// confirmation shape. No-ops if the candidate hasn't set this week's goals
// yet (no sprint to log against). If the action type is already completed
// this week, also no-ops — recurring actions award points once per week,
// so posting twice never doubles them.
export async function autoCompleteEngagementAction(
  candidateId: string,
  action: { actionType: string; text: string; points: number; estimatedMinutes: number }
) {
  const sprint = await getCurrentWeekSprint(candidateId)
  if (!sprint) return

  const actions = sprint.committedActions as unknown as CommittedAction[]
  const existing = actions.find((a) => a.actionType === action.actionType)

  if (existing) {
    if (existing.completed) return
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
      recurring: true,
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
// a catalog item except log that you did it.
export async function logCatalogAction(
  candidateId: string,
  action: { text: string; actionType?: string; points: number; estimatedMinutes: number; recurring: boolean }
) {
  const sprint = await getCurrentWeekSprint(candidateId)
  if (!sprint) return

  const actions = sprint.committedActions as unknown as CommittedAction[]
  actions.push({
    text: action.text,
    actionType: action.actionType,
    points: action.points,
    estimatedMinutes: action.estimatedMinutes,
    completed: true,
    completedAt: new Date().toISOString(),
    recurring: action.recurring,
    addedFromCatalog: true,
  })

  await prisma.weeklySprint.update({
    where: { id: sprint.id },
    data: { committedActions: actions as unknown as Prisma.InputJsonValue },
  })
}
