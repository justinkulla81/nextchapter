import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Grade } from '@/lib/scoring/grade'
import { suppressSmallCells, type MaybeSuppressed } from '@/lib/admin/cell-suppression'
import { EXCLUDE_SYSTEM_ACCOUNT } from '@/lib/admin/system-account-filter'

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
//
// Every segment row is run through cell-suppression.ts's minimum-cell-size
// gate (Part B Prompt 8: "a segment of 2 identifies people") before it's
// returned — this is the closest existing segment-breakdown view to the
// ones Part B's /admin/issues and /admin/population pages will build, and
// it had no such guard until now.
export async function computeStructuralCorrelation(): Promise<Record<string, MaybeSuppressed<StructuralCorrelationRow>[]>> {
  const candidates = await prisma.candidateProfile.findMany({
    where: EXCLUDE_SYSTEM_ACCOUNT,
    select: {
      hasMBA: true,
      highestEducationLevel: true,
      jobHoppingFlag: true,
      careerTrajectory: true,
      bountyClaims: { select: { status: true } },
      // MarketRealitySnapshot (weekly, guaranteed cadence) rather than
      // MarketRealityReport — a report only generates on specific triggers.
      marketRealitySnapshots: {
        orderBy: { weekStartDate: 'desc' },
        take: 1,
        select: { grade: true },
      },
    },
  })

  const enriched = candidates.map((c) => ({
    ...c,
    hasApprovedOffer: c.bountyClaims.some((b) => b.status === 'APPROVED'),
    grade: (c.marketRealitySnapshots[0]?.grade as Grade | undefined) ?? null,
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

  const suppress = (rows: StructuralCorrelationRow[]) =>
    suppressSmallCells(rows, (r) => r.candidateCount, (r) => r.label)

  return {
    'Has MBA': suppress(hasMBA),
    'Highest education level': suppress(education),
    'Job-hopping flag': suppress(jobHopping),
    'Career trajectory': suppress(careerTrajectory),
  }
}
