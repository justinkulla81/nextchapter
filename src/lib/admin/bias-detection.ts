import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Grade } from '@/lib/scoring/grade'

// Prompt 69 — admin-only aggregate bias-detection dashboard. Never call
// this from anything candidate-, coach-, recruiter-, or hiring-manager-
// facing — see the hard guardrail comment on the EEOC fields in
// prisma/schema.prisma. The suppression here is the actual enforcement
// point: every group below this threshold is stripped of its numbers
// before the function returns, so there is no path (UI bug, forgotten
// CSS class, etc.) that could leak a small, potentially re-identifying
// cohort's numbers to whoever views the page.
const DEFAULT_MIN_COHORT_SIZE = 20
export function getMinCohortSize(): number {
  const raw = process.env.BIAS_DASHBOARD_MIN_COHORT_SIZE
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MIN_COHORT_SIZE
}

export interface CohortStats {
  label: string
  count: number
  suppressed: false
  gradeDistribution: Record<Grade, number>
  avgJobFitScore: number | null
  avgSkillsExecutionScore: number | null
  badgeEarningRatePct: number
}

export interface SuppressedCohort {
  label: string
  count: number
  suppressed: true
}

export type CohortRow = CohortStats | SuppressedCohort

export interface BiasDetectionSection {
  dimension: string
  cohorts: CohortRow[]
  minCohortSize: number
}

const GRADES: Grade[] = ['A', 'B', 'C', 'D', 'F']

function emptyGradeDistribution(): Record<Grade, number> {
  return { A: 0, B: 0, C: 0, D: 0, F: 0 }
}

interface CandidateForBias {
  id: string
  eeocGenderIdentity: string | null
  eeocRaceEthnicity: string | null
  eeocDisabilityStatus: string | null
  eeocVeteranStatus: string | null
  categoryBaselineScores: unknown
  jobPostings: { fitScore: number | null }[]
  learningBadges: { id: string }[]
  weeklyBadgesEarned: { id: string }[]
}

function buildCohorts(
  candidates: CandidateForBias[],
  fieldKey: keyof Pick<
    CandidateForBias,
    'eeocGenderIdentity' | 'eeocRaceEthnicity' | 'eeocDisabilityStatus' | 'eeocVeteranStatus'
  >,
  gradeByCandidateId: Map<string, Grade | null>,
  minCohortSize: number
): CohortRow[] {
  const groups = new Map<string, CandidateForBias[]>()
  for (const c of candidates) {
    const value = c[fieldKey]
    if (!value) continue // unanswered — excluded from the comparison entirely
    const group = groups.get(value) ?? []
    group.push(c)
    groups.set(value, group)
  }

  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, members]): CohortRow => {
      if (members.length < minCohortSize) {
        return { label, count: members.length, suppressed: true }
      }

      const gradeDistribution = emptyGradeDistribution()
      let gradedCount = 0
      for (const m of members) {
        const grade = gradeByCandidateId.get(m.id)
        if (grade) {
          gradeDistribution[grade]++
          gradedCount++
        }
      }
      // Normalize to a percentage of graded candidates in this cohort so
      // cohorts of different sizes are visually comparable.
      const gradeDistributionPct = emptyGradeDistribution()
      if (gradedCount > 0) {
        for (const g of GRADES) {
          gradeDistributionPct[g] = Math.round((gradeDistribution[g] / gradedCount) * 100)
        }
      }

      const fitScores = members.flatMap((m) => m.jobPostings.map((j) => j.fitScore).filter((s): s is number => s != null))
      const avgJobFitScore =
        fitScores.length > 0 ? Math.round(fitScores.reduce((a, b) => a + b, 0) / fitScores.length) : null

      const skillsScores = members
        .map((m) => {
          const scores = m.categoryBaselineScores as Record<string, number> | null
          return scores?.skillsExecution ?? null
        })
        .filter((s): s is number => s != null)
      const avgSkillsExecutionScore =
        skillsScores.length > 0
          ? Math.round(skillsScores.reduce((a, b) => a + b, 0) / skillsScores.length)
          : null

      const badgedCount = members.filter(
        (m) => m.learningBadges.length > 0 || m.weeklyBadgesEarned.length > 0
      ).length
      const badgeEarningRatePct = Math.round((badgedCount / members.length) * 100)

      return {
        label,
        count: members.length,
        suppressed: false,
        gradeDistribution: gradeDistributionPct,
        avgJobFitScore,
        avgSkillsExecutionScore,
        badgeEarningRatePct,
      }
    })
}

export async function getBiasDetectionSections(): Promise<BiasDetectionSection[]> {
  const minCohortSize = getMinCohortSize()

  const [candidates, latestReports] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: {
        OR: [
          { eeocGenderIdentity: { not: null } },
          { eeocRaceEthnicity: { not: null } },
          { eeocDisabilityStatus: { not: null } },
          { eeocVeteranStatus: { not: null } },
        ],
      },
      select: {
        id: true,
        eeocGenderIdentity: true,
        eeocRaceEthnicity: true,
        eeocDisabilityStatus: true,
        eeocVeteranStatus: true,
        categoryBaselineScores: true,
        jobPostings: { select: { fitScore: true } },
        learningBadges: { select: { id: true }, take: 1 },
        weeklyBadgesEarned: { select: { id: true }, take: 1 },
      },
    }),
    // Most recent MarketRealitySnapshot per candidate, read as a cheap
    // persisted snapshot rather than live-recomputing the grade for every
    // candidate on every dashboard load. MarketRealitySnapshot (weekly,
    // guaranteed cadence) rather than MarketRealityReport — a report only
    // generates on specific triggers.
    prisma.marketRealitySnapshot.findMany({
      orderBy: { weekStartDate: 'desc' },
      select: { candidateId: true, grade: true },
    }),
  ])

  const gradeByCandidateId = new Map<string, Grade | null>()
  for (const snapshot of latestReports) {
    if (gradeByCandidateId.has(snapshot.candidateId)) continue // keep only the first (most recent) per candidate
    gradeByCandidateId.set(snapshot.candidateId, (snapshot.grade as Grade | null) ?? null)
  }

  const candidatesForBias: CandidateForBias[] = candidates

  return [
    { dimension: 'Gender identity', cohorts: buildCohorts(candidatesForBias, 'eeocGenderIdentity', gradeByCandidateId, minCohortSize), minCohortSize },
    { dimension: 'Race / ethnicity', cohorts: buildCohorts(candidatesForBias, 'eeocRaceEthnicity', gradeByCandidateId, minCohortSize), minCohortSize },
    { dimension: 'Disability status', cohorts: buildCohorts(candidatesForBias, 'eeocDisabilityStatus', gradeByCandidateId, minCohortSize), minCohortSize },
    { dimension: 'Veteran status', cohorts: buildCohorts(candidatesForBias, 'eeocVeteranStatus', gradeByCandidateId, minCohortSize), minCohortSize },
  ]
}
