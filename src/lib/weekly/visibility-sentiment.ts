import 'server-only'
import type { PublicDisclosureComfort } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const COMFORT_SCORE: Record<PublicDisclosureComfort, number> = {
  PRIVATE_ONLY: 0,
  CLOSE_CONTACTS_ONLY: 1,
  BECOMING_COMFORTABLE: 2,
  FULLY_COMFORTABLE: 3,
}

export interface VisibilityComfortTrend {
  lowComfort: boolean
  reason: 'low_average' | 'declining_trend' | null
}

const LOW_COMFORT_THRESHOLD = 1 // mostly "private only" over the trailing window (0-3 scale)
const DECLINING_TREND_THRESHOLD = 0.75 // same delta convention as getSentimentAlert

// Coaching-only sentiment signal (never a grade input — see
// computeWeeklyEngines, which reads privacyTier, not this) mirroring
// getSentimentAlert's trailing-window/decline-check math (src/lib/daily/mood.ts),
// but over WEEKS: visibilityComfort is answered at most once per WeeklySprint,
// not daily, so the window is "however many of the last 12 weeks have an
// answer" rather than a fixed calendar-day cutoff.
export async function getVisibilityComfortTrend(candidateId: string): Promise<VisibilityComfortTrend> {
  const sprints = await prisma.weeklySprint.findMany({
    where: { candidateId, visibilityComfort: { not: null } },
    orderBy: { weekStartDate: 'asc' },
    select: { visibilityComfort: true },
    take: 12,
  })

  if (sprints.length === 0) return { lowComfort: false, reason: null }

  const scores = sprints.map((s) => COMFORT_SCORE[s.visibilityComfort!])
  const average = scores.reduce((sum, s) => sum + s, 0) / scores.length
  if (average < LOW_COMFORT_THRESHOLD) return { lowComfort: true, reason: 'low_average' }

  if (scores.length >= 3) {
    const mid = Math.floor(scores.length / 2)
    const firstHalf = scores.slice(0, mid)
    const secondHalf = scores.slice(mid)
    const avg = (arr: number[]) => arr.reduce((sum, s) => sum + s, 0) / arr.length
    if (avg(firstHalf) - avg(secondHalf) >= DECLINING_TREND_THRESHOLD) {
      return { lowComfort: true, reason: 'declining_trend' }
    }
  }

  return { lowComfort: false, reason: null }
}
