import { prisma } from '@/lib/prisma'
import { calculateEmployabilityScore, scoreToVisibilityTier } from './employability-score'

export async function recalculateScore(candidateId: string, triggerEvent: string) {
  const breakdown = await calculateEmployabilityScore(candidateId)
  const visibilityTier = scoreToVisibilityTier(breakdown.total)

  await Promise.all([
    prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        employabilityScore: breakdown.total,
        scoreLastCalculated: new Date(),
        visibilityTier,
      },
    }),
    prisma.employabilityScoreHistory.create({
      data: {
        candidateId,
        score: breakdown.total,
        signalDepth: breakdown.signalDepth,
        narrativeClarity: breakdown.narrativeClarity,
        desireSignal: breakdown.desireSignal,
        consistency: breakdown.consistency,
        aiFlexibility: breakdown.aiFlexibility,
        triggerEvent,
      },
    }),
  ])

  return { breakdown, visibilityTier }
}
