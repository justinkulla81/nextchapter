import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { computePerformanceScores, type PerformanceResponseInput } from '@/lib/scoring/performance-vectors'

/**
 * Saves a finished How I perform assessment: the response row with its five scores, the first-time effort credit
 * and the completion event. Shared by the long form's action and the short-rounds flow, so both save exactly the same thing.
 * The caller has already checked that all forty statements are answered.
 */
export async function recordPerformanceAssessment(candidateId: string, responses: PerformanceResponseInput[], extra: Record<string, unknown> = {}): Promise<void> {
  const scores = computePerformanceScores(responses)

  const isFirstResponse = (await prisma.performanceAssessmentResponse.count({ where: { candidateId } })) === 0

  await prisma.performanceAssessmentResponse.create({
    data: {
      candidateId,
      responses: responses as unknown as Prisma.InputJsonValue,
      executionScore: scores.execution,
      judgmentScore: scores.judgment,
      composureScore: scores.composure,
      influenceScore: scores.influence,
      integrityScore: scores.integrity,
    },
  })

  captureServerEvent(candidateId, 'performance_assessment_completed', { isRetake: !isFirstResponse, ...extra })

  if (isFirstResponse) {
    const sprint = await getCurrentWeekSprint(candidateId)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'PERFORMANCE_ASSESSMENT_COMPLETED' })
      await autoCompleteEngagementAction(candidateId, {
        actionType: 'PERFORMANCE_ASSESSMENT_COMPLETED',
        text: 'Complete How I Perform',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      })
    }
  }
}
