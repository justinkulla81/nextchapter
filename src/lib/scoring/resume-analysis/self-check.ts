// Self-check — the non-negotiable invariant from the build script and spec
// §4.11/§8: no generated number may reach storage (or, later, a rendered
// report) contradicting its source. This layer validates that the
// ResumeAnalysis computation itself is internally consistent — composite
// math, band assignment, cap enforcement — before compute.ts persists it.
// The complementary check (free-form report prose vs. this object's facts)
// belongs to the report generator built in Phase 7, once that prose
// actually exists; this is the check that has to pass before Phase 7 even
// has a trustworthy object to generate from.

import { BASE_DIMENSION_WEIGHTS } from './weights'
import { scoreToResumeBand } from './types'
import type { DimensionScores, ResumeBand } from './types'

export interface SelfCheckInput {
  dimensionScores: DimensionScores
  weights: Record<string, number>
  prestigeBonus: number
  reconciliationPenalty: number
  extracurricularBonus: number
  composite: number
  band: ResumeBand
  firstGlanceScore: number | null
}

export interface SelfCheckResult {
  passed: boolean
  errors: string[]
}

const EPSILON = 0.6 // rounding tolerance across the weighted sum

export function selfCheckResumeAnalysis(input: SelfCheckInput): SelfCheckResult {
  const errors: string[] = []

  // Every dimension key present, every score in range.
  for (const key of Object.keys(BASE_DIMENSION_WEIGHTS)) {
    const score = input.dimensionScores[key as keyof DimensionScores]
    if (score === undefined) errors.push(`Missing dimension score: ${key}`)
    else if (score < 0 || score > 100) errors.push(`Dimension ${key} out of range: ${score}`)
  }

  // Modifier caps — spec §3.2/§3.3/§4.12, non-negotiable.
  if (input.prestigeBonus < 0 || input.prestigeBonus > 6) {
    errors.push(`Prestige bonus out of cap: ${input.prestigeBonus} (must be 0-6)`)
  }
  if (input.reconciliationPenalty > 0 || input.reconciliationPenalty < -12) {
    errors.push(`Reconciliation penalty out of cap: ${input.reconciliationPenalty} (must be -12-0)`)
  }
  if (input.extracurricularBonus < 0 || input.extracurricularBonus > 3) {
    errors.push(`Extracurricular bonus out of cap: ${input.extracurricularBonus} (must be 0-3)`)
  }

  // Composite must equal the weighted subtotal plus modifiers, clamped.
  const weightedSubtotal = Object.entries(input.dimensionScores).reduce((sum, [key, score]) => {
    const weight = input.weights[key] ?? 0
    return sum + (score * weight) / 100
  }, 0)
  const expectedComposite = Math.max(
    0,
    Math.min(100, Math.round(weightedSubtotal + input.prestigeBonus + input.reconciliationPenalty + input.extracurricularBonus))
  )
  if (Math.abs(expectedComposite - input.composite) > EPSILON) {
    errors.push(`Composite ${input.composite} does not match expected ${expectedComposite} from weighted dimensions + modifiers`)
  }

  // Band must match the composite exactly — never narrated at odds with
  // the number that produced it.
  const expectedBand = scoreToResumeBand(input.composite)
  if (expectedBand !== input.band) {
    errors.push(`Band ${input.band} does not match composite ${input.composite} (expected ${expectedBand})`)
  }

  // The prestige cap can move a candidate at most one band on its own
  // (spec §3.2) — check by re-deriving the band with prestige zeroed.
  const compositeWithoutPrestige = Math.max(
    0,
    Math.min(100, Math.round(weightedSubtotal + input.reconciliationPenalty + input.extracurricularBonus))
  )
  const bandOrder: ResumeBand[] = ['F', 'D', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A']
  const bandIndex = (b: ResumeBand) => bandOrder.indexOf(b)
  const bandWithoutPrestige = scoreToResumeBand(compositeWithoutPrestige)
  if (Math.abs(bandIndex(expectedBand) - bandIndex(bandWithoutPrestige)) > 1) {
    errors.push(`Prestige bonus moved the band by more than one step (${bandWithoutPrestige} -> ${expectedBand})`)
  }

  if (input.firstGlanceScore !== null && (input.firstGlanceScore < 0 || input.firstGlanceScore > 100)) {
    errors.push(`First Glance score out of range: ${input.firstGlanceScore}`)
  }

  return { passed: errors.length === 0, errors }
}
