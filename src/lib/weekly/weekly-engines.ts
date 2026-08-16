// Weekly Search Score — extracted from the old six-category grade module
// (dossier-competencies.ts) since it was always fully independent of that
// system: this only ever reads WeeklySprint data and pointsNeededForA's
// ramp, never a category baseline or the six-category computation. Kept
// standalone here so Weekly Search Score keeps working exactly as before
// even though the letter grade it used to feed into is gone.

import 'server-only'
import type { PrivacyTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentWeekSprint, type CommittedAction } from '@/lib/weekly/sprint'
import { pointsNeededForA, engineForActionType, getEarnedPoints } from '@/lib/weekly/action-effort'
import {
  scoreToGrade,
  CATEGORY_MINIMUM_ENFORCED_FROM_WEEK,
  CATEGORY_MINIMUM_SCORE_FLOOR,
  WEEKLY_ENGINE_LABEL,
  type WeeklyEngine,
  type WeeklyEngineKey,
} from '@/lib/scoring/grade'

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export interface WeeklyProgress {
  engines: WeeklyEngine[]
  weeklyPoints: number
  weeklyPointsTarget: number
  laggingEngines: WeeklyEngineKey[]
  categoryMinimumsMet: boolean
}

export async function computeWeeklyProgress(
  candidateId: string,
  weekNumber: number,
  privacyTier: PrivacyTier,
  confidentialSearchMode: boolean
): Promise<WeeklyProgress> {
  const weeklyPointsTarget = pointsNeededForA(weekNumber)
  const perEngineTarget = weeklyPointsTarget / 4

  const [sprint, weeklySprintCount] = await Promise.all([
    getCurrentWeekSprint(candidateId),
    prisma.weeklySprint.count({ where: { candidateId } }),
  ])
  const committedActions = sprint ? (sprint.committedActions as unknown as CommittedAction[]) : []

  const pointsByEngine: Record<WeeklyEngineKey, number> = { learning: 0, effort: 0, working: 0, connecting: 0 }
  for (const action of committedActions) {
    const engine = engineForActionType(action.actionType)
    pointsByEngine[engine] += getEarnedPoints(action)
  }

  // Being Public/Semi-Public (or in Confidential Search Mode) amplifies
  // real networking effort already done this week — never manufactures
  // connecting-engine score from nothing (gated on pointsByEngine.connecting
  // > 0). See the git history on dossier-competencies.ts for the original,
  // fuller reasoning — unchanged here, just relocated.
  const visibilityBonusEligible = privacyTier === 'PUBLIC' || privacyTier === 'SEMI_PUBLIC' || confidentialSearchMode
  if (visibilityBonusEligible && pointsByEngine.connecting > 0) {
    pointsByEngine.connecting += 5
  }

  const weeklyPoints = Object.values(pointsByEngine).reduce((sum, p) => sum + p, 0)

  const engines: WeeklyEngine[] = (['learning', 'effort', 'working', 'connecting'] as const).map((key) => {
    const score = perEngineTarget > 0 ? clamp((pointsByEngine[key] / perEngineTarget) * 100) : 0
    return { key, label: WEEKLY_ENGINE_LABEL[key], score, grade: scoreToGrade(score) }
  })

  const laggingEngines = engines.filter((e) => e.score < CATEGORY_MINIMUM_SCORE_FLOOR).map((e) => e.key)
  const categoryMinimumsMet = weeklySprintCount < CATEGORY_MINIMUM_ENFORCED_FROM_WEEK || laggingEngines.length === 0

  return { engines, weeklyPoints, weeklyPointsTarget, laggingEngines, categoryMinimumsMet }
}
