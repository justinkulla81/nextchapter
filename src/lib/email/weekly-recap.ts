import 'server-only'
import { getCurrentWeekSprint, getCandidateWeekNumber, getMondayOfWeek, type CommittedAction } from '@/lib/weekly/sprint'
import { pointsNeededForA, getEarnedPoints } from '@/lib/weekly/action-effort'
import { isProfileChecklistActionType } from '@/lib/weekly/profile-checklist-types'

export interface WeeklyRecap {
  pointsEarned: number
  pointsTarget: number
  completedTexts: string[]
}

// A running "here's what you've gotten done this week" recap folded into
// several weekday emails — reinforces progress already made instead of only
// ever asking for the next thing. Returns null before anything's been
// completed yet this week (a 0-of-N recap reads as a nag, not encouragement).
export async function buildWeeklyRecap(candidateId: string): Promise<WeeklyRecap | null> {
  const weekNumber = await getCandidateWeekNumber(candidateId, getMondayOfWeek(new Date()))
  const sprint = await getCurrentWeekSprint(candidateId)
  if (!sprint) return null

  const actions = (sprint.committedActions as unknown as CommittedAction[]) ?? []
  const completed = actions.filter(
    (a) => a.completed && !a.isGoalBonus && !isProfileChecklistActionType(a.actionType)
  )
  if (completed.length === 0) return null

  const pointsEarned = completed.reduce((sum, a) => sum + getEarnedPoints(a), 0)
  const completedTexts = [...new Set(completed.map((a) => a.text))].slice(0, 5)

  return {
    pointsEarned,
    pointsTarget: pointsNeededForA(weekNumber),
    completedTexts,
  }
}
