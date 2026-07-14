import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface CommittedAction {
  text: string
  actionType?: string
  difficulty: 1 | 2 | 3
  completed: boolean
  completedAt?: string
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

export async function getCurrentWeekSprint(candidateId: string) {
  const weekStartDate = getMondayOfWeek(new Date())
  return prisma.weeklySprint.findUnique({ where: { candidateId_weekStartDate: { candidateId, weekStartDate } } })
}

// Search Execution is graded from real weekly follow-through — until a
// candidate has committed to at least one Success Sprint, there's nothing
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
export async function getSuggestedActions(candidateId: string): Promise<SuggestedAction[]> {
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

export async function commitWeeklySprint(
  candidateId: string,
  actions: { text: string; actionType?: string; difficulty: 1 | 2 | 3 }[]
) {
  const weekStartDate = getMondayOfWeek(new Date())
  const committedActions: CommittedAction[] = actions.map((a) => ({
    text: a.text,
    actionType: a.actionType,
    difficulty: a.difficulty,
    completed: false,
  }))

  return prisma.weeklySprint.upsert({
    where: { candidateId_weekStartDate: { candidateId, weekStartDate } },
    create: { candidateId, weekStartDate, committedActions: committedActions as unknown as Prisma.InputJsonValue },
    update: { committedActions: committedActions as unknown as Prisma.InputJsonValue },
  })
}

export async function toggleSprintActionCompletion(candidateId: string, actionIndex: number) {
  const sprint = await getCurrentWeekSprint(candidateId)
  if (!sprint) return

  const actions = sprint.committedActions as unknown as CommittedAction[]
  const target = actions[actionIndex]
  if (!target) return

  target.completed = !target.completed
  target.completedAt = target.completed ? new Date().toISOString() : undefined

  await prisma.weeklySprint.update({
    where: { id: sprint.id },
    data: { committedActions: actions as unknown as Prisma.InputJsonValue },
  })
}
