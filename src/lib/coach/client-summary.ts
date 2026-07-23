import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Grade, HireabilityGrade } from '@/lib/scoring/grade'
import { normalizeGradeSnapshot } from '@/lib/scoring/hireability-grade'

const GRADE_ORDER: Grade[] = ['F', 'D', 'C', 'B', 'A']

export type Trend = 'up' | 'down' | 'flat' | null

export interface ClientSummary {
  id: string
  name: string
  weekNumber: number | null
  executionGrade: Grade | null
  trend: Trend
  lastActiveAt: Date | null
}

function trendFor(latest: Grade | null, previous: Grade | null): Trend {
  if (!latest || !previous) return null
  const diff = GRADE_ORDER.indexOf(latest) - GRADE_ORDER.indexOf(previous)
  if (diff > 0) return 'up'
  if (diff < 0) return 'down'
  return 'flat'
}

export async function getCoachClientSummaries(coachId: string): Promise<ClientSummary[]> {
  const clients = await prisma.candidateProfile.findMany({
    where: { coachId },
    include: {
      hireabilityReports: { orderBy: { generatedAt: 'desc' }, take: 2, select: { hireabilityGradeAtGeneration: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return clients.map((c) => {
    const [latestReport, previousReport] = c.hireabilityReports
    const latestGrade =
      normalizeGradeSnapshot(latestReport?.hireabilityGradeAtGeneration)?.grade ?? null
    const previousGrade =
      normalizeGradeSnapshot(previousReport?.hireabilityGradeAtGeneration)?.grade ?? null

    const weekNumber = c.registrationCompletedAt
      ? Math.floor((Date.now() - c.registrationCompletedAt.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
      : null

    return {
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed candidate',
      weekNumber,
      executionGrade: latestGrade,
      trend: trendFor(latestGrade, previousGrade),
      lastActiveAt: c.lastCheckInAt ?? c.registrationCompletedAt,
    }
  })
}
