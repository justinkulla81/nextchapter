// Self-check — the non-negotiable invariant from the build script and spec
// §4.11/§8: no generated number may reach storage (or, later, a rendered
// report) contradicting its source. This layer validates that the
// ResumeAnalysis computation itself is internally consistent — composite
// math, band assignment, cap enforcement — before compute.ts persists it.
// Restructured per Master Build Script §3.1: there are now two independent
// composites (Experience, Resume), each with its own weighted subtotal,
// modifiers, and band — checked separately rather than as one blended sum.
// The complementary check (free-form report prose vs. this object's facts)
// belongs to the report generator built in Phase 7, once that prose
// actually exists; this is the check that has to pass before Phase 7 even
// has a trustworthy object to generate from.

import { DIMENSION_ORDER, scoreToExperienceBand, scoreToResumeBand } from './types'
import type { DimensionScores, ExperienceBand, ResumeBand } from './types'

export interface SelfCheckInput {
  dimensionScores: DimensionScores
  experienceWeights: Record<string, number>
  resumeWeights: Record<string, number>
  extracurricularBonus: number
  experienceTrajectoryBonus: number
  prestigeBonus: number
  reconciliationPenalty: number
  experienceScore: number
  resumeScore: number
  experienceBand: ExperienceBand
  resumeBand: ResumeBand
  firstGlanceScore: number | null
}

export interface SelfCheckResult {
  passed: boolean
  errors: string[]
}

const EPSILON = 0.6 // rounding tolerance across the weighted sum

function weightedSubtotal(dimensionScores: DimensionScores, weights: Record<string, number>): number {
  return Object.entries(weights).reduce((sum, [key, weight]) => {
    const score = dimensionScores[key as keyof DimensionScores] ?? 0
    return sum + (score * weight) / 100
  }, 0)
}

export function selfCheckResumeAnalysis(input: SelfCheckInput): SelfCheckResult {
  const errors: string[] = []

  // Every dimension key present, every score in range.
  for (const key of DIMENSION_ORDER) {
    const score = input.dimensionScores[key]
    if (score === undefined) errors.push(`Missing dimension score: ${key}`)
    else if (score < 0 || score > 100) errors.push(`Dimension ${key} out of range: ${score}`)
  }

  // Modifier caps — spec §3.2/§3.3/§4.12, non-negotiable. Prestige and
  // reconciliation apply to Resume only (Master Build Script §3.1/§9);
  // extracurricular/governance and experience-trajectory (promotion
  // velocity) apply to Experience only (§9 doesn't name a component for
  // extracurricular — assigned here since board seats/associations are
  // career facts, not document properties; trajectory bonus follows the
  // same logic — it's about the career, not the document). Cap literals
  // below are hand-kept in sync with modifiers.ts's
  // RESUME_GRADE_PRESTIGE_CAP/EXPERIENCE_TRAJECTORY_CAP constants, same
  // convention this file already uses for the other two caps.
  if (input.prestigeBonus < 0 || input.prestigeBonus > 10) {
    errors.push(`Prestige bonus out of cap: ${input.prestigeBonus} (must be 0-10)`)
  }
  if (input.reconciliationPenalty > 0 || input.reconciliationPenalty < -12) {
    errors.push(`Reconciliation penalty out of cap: ${input.reconciliationPenalty} (must be -12-0)`)
  }
  if (input.extracurricularBonus < 0 || input.extracurricularBonus > 3) {
    errors.push(`Extracurricular bonus out of cap: ${input.extracurricularBonus} (must be 0-3)`)
  }
  if (input.experienceTrajectoryBonus < 0 || input.experienceTrajectoryBonus > 8) {
    errors.push(`Experience trajectory bonus out of cap: ${input.experienceTrajectoryBonus} (must be 0-8)`)
  }

  // Experience composite = weighted subtotal + extracurricular bonus +
  // experience trajectory (promotion velocity) bonus.
  const experienceSubtotal = weightedSubtotal(input.dimensionScores, input.experienceWeights)
  const expectedExperience = Math.max(
    0,
    Math.min(100, Math.round(experienceSubtotal + input.extracurricularBonus + input.experienceTrajectoryBonus))
  )
  if (Math.abs(expectedExperience - input.experienceScore) > EPSILON) {
    errors.push(`Experience score ${input.experienceScore} does not match expected ${expectedExperience} from weighted dimensions + extracurricular + trajectory bonus`)
  }
  const expectedExperienceBand = scoreToExperienceBand(input.experienceScore)
  if (expectedExperienceBand !== input.experienceBand) {
    errors.push(`Experience band ${input.experienceBand} does not match score ${input.experienceScore} (expected ${expectedExperienceBand})`)
  }

  // Resume composite = weighted subtotal + prestige bonus + reconciliation penalty.
  const resumeSubtotal = weightedSubtotal(input.dimensionScores, input.resumeWeights)
  const expectedResume = Math.max(
    0,
    Math.min(100, Math.round(resumeSubtotal + input.prestigeBonus + input.reconciliationPenalty))
  )
  if (Math.abs(expectedResume - input.resumeScore) > EPSILON) {
    errors.push(`Resume score ${input.resumeScore} does not match expected ${expectedResume} from weighted dimensions + prestige + reconciliation`)
  }
  const expectedResumeBand = scoreToResumeBand(input.resumeScore)
  if (expectedResumeBand !== input.resumeBand) {
    errors.push(`Resume band ${input.resumeBand} does not match score ${input.resumeScore} (expected ${expectedResumeBand})`)
  }

  // The prestige cap can move Resume's band at most two steps on its own
  // (widened from one step when RESUME_GRADE_PRESTIGE_CAP grew from 6 to 10
  // for the Market Reality Grade recalibration — a bare one-step tolerance
  // at the old cap would fail closed on exactly the elite candidates the
  // wider cap exists to reward) — check by re-deriving the band with
  // prestige zeroed.
  const resumeWithoutPrestige = Math.max(0, Math.min(100, Math.round(resumeSubtotal + input.reconciliationPenalty)))
  const resumeBandOrder: ResumeBand[] = ['F', 'D', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A']
  const resumeBandIndex = (b: ResumeBand) => resumeBandOrder.indexOf(b)
  const bandWithoutPrestige = scoreToResumeBand(resumeWithoutPrestige)
  if (Math.abs(resumeBandIndex(expectedResumeBand) - resumeBandIndex(bandWithoutPrestige)) > 2) {
    errors.push(`Prestige bonus moved the Resume band by more than two steps (${bandWithoutPrestige} -> ${expectedResumeBand})`)
  }

  // Same invariant, mirrored for the new experience-trajectory (promotion
  // velocity) bonus's effect on the Experience band.
  const experienceWithoutTrajectory = Math.max(0, Math.min(100, Math.round(experienceSubtotal + input.extracurricularBonus)))
  const experienceBandOrder: ExperienceBand[] = ['F', 'D', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A']
  const experienceBandIndex = (b: ExperienceBand) => experienceBandOrder.indexOf(b)
  const experienceBandWithoutTrajectory = scoreToExperienceBand(experienceWithoutTrajectory)
  if (Math.abs(experienceBandIndex(expectedExperienceBand) - experienceBandIndex(experienceBandWithoutTrajectory)) > 2) {
    errors.push(`Experience trajectory bonus moved the Experience band by more than two steps (${experienceBandWithoutTrajectory} -> ${expectedExperienceBand})`)
  }

  if (input.firstGlanceScore !== null && (input.firstGlanceScore < 0 || input.firstGlanceScore > 100)) {
    errors.push(`First Glance score out of range: ${input.firstGlanceScore}`)
  }

  return { passed: errors.length === 0, errors }
}
