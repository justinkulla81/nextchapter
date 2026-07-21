import 'server-only'
import { prisma } from '@/lib/prisma'
import {
  computeMarketRealityDimensions,
  GRADE_RELATIONS_INCLUDE,
  type CandidateWithGradeRelations,
} from '@/lib/scoring/hireability-grade'
import { scoreToGrade } from '@/lib/scoring/grade'
import { computeNamedReasons, type NamedReason } from '@/lib/scoring/named-reasons'

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

// Generates and archives this week's Market Reality Grade + named-reasons
// snapshot for one candidate. Idempotent per (candidateId, weekStartDate) —
// safe to re-run the cron without creating duplicate weeks. Never
// overwrites a prior week's snapshot; only ever creates the current week's
// if it doesn't already exist.
export async function generateMarketRealitySnapshot(candidateId: string, weekStartDate: Date): Promise<void> {
  const existing = await prisma.marketRealitySnapshot.findUnique({
    where: { candidateId_weekStartDate: { candidateId, weekStartDate } },
  })
  if (existing) return

  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: GRADE_RELATIONS_INCLUDE,
  })

  const latestAiProject = await prisma.learningBadge.findFirst({
    where: { candidateId, badgeType: 'ai_project', judgmentCall: { not: null } },
    orderBy: { completedAt: 'desc' },
  })

  const dimensions = await computeMarketRealityDimensions(candidate as unknown as CandidateWithGradeRelations)
  const marketRealityScore = clamp(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length)
  const grade = scoreToGrade(marketRealityScore)
  const namedReasons: NamedReason[] = computeNamedReasons(dimensions, latestAiProject?.judgmentCall ?? null)

  await prisma.marketRealitySnapshot.create({
    data: {
      candidateId,
      weekStartDate,
      grade,
      dimensions: dimensions as unknown as object,
      namedReasons: namedReasons as unknown as object,
    },
  })
}
