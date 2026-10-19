import 'server-only'
import type { PrivacyTier } from '@prisma/client'
import { getCurrentWeekSprint, getMondayOfWeek } from '@/lib/weekly/sprint'
import { computeWeeklyEngines } from '@/lib/scoring/dossier-competencies'

export interface WeeklyGap {
  weeklyPoints: number
  weeklyPointsTarget: number
  pointsToGo: number
}

/**
 * How far a member is from this week's A, or null when there is nothing to
 * say: they registered partway through this week (they never had the full
 * week), have no sprint committed, or are already at or above target.
 */
export async function computeWeeklyGap(
  candidate: {
    id: string
    privacyTier: PrivacyTier
    confidentialSearchMode: boolean
    registrationCompletedAt: Date | null
    weeklySprintCount: number
  },
  now = new Date()
): Promise<WeeklyGap | null> {
  if (candidate.registrationCompletedAt && candidate.registrationCompletedAt >= getMondayOfWeek(now)) return null
  const sprint = await getCurrentWeekSprint(candidate.id)
  if (!sprint) return null
  const { weeklyPoints, weeklyPointsTarget } = await computeWeeklyEngines(
    candidate.id,
    candidate.weeklySprintCount,
    candidate.privacyTier,
    candidate.confidentialSearchMode
  )
  if (weeklyPoints >= weeklyPointsTarget) return null
  return { weeklyPoints, weeklyPointsTarget, pointsToGo: weeklyPointsTarget - weeklyPoints }
}
