import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeGradeSnapshot } from '@/lib/scoring/dossier-competencies'
import type { Grade } from '@/lib/scoring/grade'

export interface StructuralCorrelationRow {
  label: string
  candidateCount: number
  approvedOfferRate: number | null // % of candidates in this segment with a BountyClaim.status === 'APPROVED'
  gradeDistribution: string // e.g. "A:2 B:5 C:12 D:3 F:1" — a mode, not an invented numeric average
}

const GRADE_ORDER: Grade[] = ['A', 'B', 'C', 'D', 'F']

function summarizeSegment(
  label: string,
  candidates: { hasApprovedOffer: boolean; grade: Grade | null }[]
): StructuralCorrelationRow {
  const candidateCount = candidates.length
  const approvedOfferRate =
    candidateCount > 0
      ? Math.round((candidates.filter((c) => c.hasApprovedOffer).length / candidateCount) * 100)
      : null

  const counts: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 }
  for (const c of candidates) if (c.grade) counts[c.grade]++
  const gradeDistribution = GRADE_ORDER.filter((g) => counts[g] > 0)
    .map((g) => `${g}:${counts[g]}`)
    .join(' ') || '—'

  return { label, candidateCount, approvedOfferRate, gradeDistribution }
}

// Cross-tabs structural signals (job-hopping, career trajectory, education)
// against the one real, verified hiring-outcome signal in the app today —
// BountyClaim.status === 'APPROVED', offer-letter-backed, not self-reported
// — plus current grade distribution. Admin-only, internal tool; no PostHog.
export async function computeStructuralCorrelation(): Promise<Record<string, StructuralCorrelationRow[]>> {
  const candidates = await prisma.candidateProfile.findMany({
    select: {
      hasMBA: true,
      highestEducationLevel: true,
      jobHoppingFlag: true,
      careerTrajectory: true,
      bountyClaims: { select: { status: true } },
      marketRealityReports: {
        orderBy: { generatedAt: 'desc' },
        take: 1,
        select: { dossierGradeAtGeneration: true },
      },
    },
  })

  const enriched = candidates.map((c) => ({
    ...c,
    hasApprovedOffer: c.bountyClaims.some((b) => b.status === 'APPROVED'),
    grade: normalizeGradeSnapshot(c.marketRealityReports[0]?.dossierGradeAtGeneration)?.grade ?? null,
  }))

  const hasMBA = [
    summarizeSegment('Has MBA', enriched.filter((c) => c.hasMBA)),
    summarizeSegment('No MBA', enriched.filter((c) => !c.hasMBA)),
  ]

  const educationLevels = Array.from(new Set(enriched.map((c) => c.highestEducationLevel).filter(Boolean)))
  const education = educationLevels.map((level) =>
    summarizeSegment(level as string, enriched.filter((c) => c.highestEducationLevel === level))
  )

  const jobHopping = [
    summarizeSegment('Job-hopping flag', enriched.filter((c) => c.jobHoppingFlag)),
    summarizeSegment('No job-hopping flag', enriched.filter((c) => !c.jobHoppingFlag)),
  ]

  const trajectoryValues = ['PROMOTED', 'STABLE', 'DEMOTED'] as const
  const careerTrajectory = trajectoryValues
    .map((v) => summarizeSegment(v, enriched.filter((c) => c.careerTrajectory === v)))
    .filter((row) => row.candidateCount > 0)

  return {
    'Has MBA': hasMBA,
    'Highest education level': education,
    'Job-hopping flag': jobHopping,
    'Career trajectory': careerTrajectory,
  }
}
