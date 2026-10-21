import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { getEarnedPoints } from '@/lib/weekly/action-effort'
import { countsAsSearchEffort } from '@/lib/scoring/effort-actions'

// One point is one minute of effort (see weekly/action-effort.ts), so the
// sum of earned points across every weekly sprint, from the actions that count
// as search effort, is the member's total search effort in minutes. Effort is a core Candidate+ requirement: the
// dossier is about proving how hard someone works, and this is the part of
// that which no CV can show. Lifetime, not a recent window: nobody waits on
// the calendar, a candidate who puts in the time gets there sooner.

interface StoredAction {
  points?: number
  completed?: boolean
  completionCount?: number
  actionType?: string
  isGoalBonus?: boolean
}

// Only work toward getting a job counts. Setup, connecting accounts, the welcome bonus,
// check-ins, clicks and helping other members earn points but are not effort; see
// scoring/effort-actions.ts for the lists.
export function sumEffortMinutes(sprints: Array<{ committedActions: unknown }>): number {
  let total = 0
  for (const sprint of sprints) {
    const actions = Array.isArray(sprint.committedActions) ? (sprint.committedActions as StoredAction[]) : []
    for (const a of actions) {
      if (!countsAsSearchEffort(a)) continue
      total += getEarnedPoints({ points: a.points ?? 0, completed: a.completed === true, completionCount: a.completionCount })
    }
  }
  return total
}

export const getLifetimeEffortMinutes = cache(async (candidateId: string): Promise<number> => {
  const sprints = await prisma.weeklySprint.findMany({ where: { candidateId }, select: { committedActions: true } })
  return sumEffortMinutes(sprints)
})
