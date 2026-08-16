import 'server-only'
import { prisma } from '@/lib/prisma'
import { computeMarketRealityCompositeGrade } from '@/lib/scoring/market-reality/composite'
import { computeNamedReasons, type NamedReason } from '@/lib/scoring/named-reasons'
import { getVisibilityCalibration } from '@/lib/coach/visibility-calibration'

// Generates and archives this week's Current Market Reality + named-reasons
// snapshot for one candidate. Idempotent per (candidateId, weekStartDate) —
// safe to re-run the cron without creating duplicate weeks. Never
// overwrites a prior week's snapshot; only ever creates the current week's
// if it doesn't already exist.
export async function generateMarketRealitySnapshot(candidateId: string, weekStartDate: Date): Promise<void> {
  const existing = await prisma.marketRealitySnapshot.findUnique({
    where: { candidateId_weekStartDate: { candidateId, weekStartDate } },
  })
  if (existing) return

  const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } })

  const [composite, latestAiProject, visibilityCalibration] = await Promise.all([
    computeMarketRealityCompositeGrade(candidateId),
    prisma.learningBadge.findFirst({
      where: { candidateId, badgeType: 'ai_project', judgmentCall: { not: null } },
      orderBy: { completedAt: 'desc' },
    }),
    getVisibilityCalibration(candidateId),
  ])
  // No resume/experience data yet to grade — nothing honest to snapshot
  // this week; the cron will pick this candidate back up once they have one.
  if (!composite) return

  const namedReasons: NamedReason[] = computeNamedReasons([], latestAiProject?.judgmentCall ?? null, {
    jobHoppingFlag: candidate.jobHoppingFlag,
    careerTrajectory: candidate.careerTrajectory,
    visibilityGap: visibilityCalibration.gap === 'wants_more_visibility',
    gapDuration: candidate.gapDuration,
  })

  await prisma.marketRealitySnapshot.create({
    data: {
      candidateId,
      weekStartDate,
      grade: composite.grade,
      dimensions: [],
      namedReasons: namedReasons as unknown as object,
    },
  })
}
