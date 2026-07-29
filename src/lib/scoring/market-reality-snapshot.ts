import 'server-only'
import { prisma } from '@/lib/prisma'
import {
  computeCategoryGrades,
  GRADE_RELATIONS_INCLUDE,
  type CandidateWithGradeRelations,
} from '@/lib/scoring/hireability-grade'
import { scoreToGrade, type CategoryGrade } from '@/lib/scoring/grade'
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

  const categories: CategoryGrade[] = await computeCategoryGrades(candidate as unknown as CandidateWithGradeRelations)
  const marketRealityScore = clamp(categories.reduce((sum, c) => sum + c.score, 0) / categories.length)
  const grade = scoreToGrade(marketRealityScore)
  const namedReasons: NamedReason[] = computeNamedReasons(categories, latestAiProject?.judgmentCall ?? null, {
    jobHoppingFlag: candidate.jobHoppingFlag,
    careerTrajectory: candidate.careerTrajectory,
  })

  await prisma.marketRealitySnapshot.create({
    data: {
      candidateId,
      weekStartDate,
      grade,
      dimensions: categories as unknown as object,
      namedReasons: namedReasons as unknown as object,
    },
  })
}
