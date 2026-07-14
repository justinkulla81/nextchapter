// Work-style assessment scoring — quad-block (ipsative "least like me" only)
// + Likert cross-validation.
//
// IMPORTANT — this is a first-pass, unvalidated heuristic, not a
// professionally calibrated psychometric model. Real IRT-based ipsative
// scoring needs population data this app doesn't have yet. Two limits to
// respect wherever this output is consumed:
//
// 1. Ipsative fixed-sum: each quad-block shows 4 statements and the
//    candidate rejects exactly one ("least like me"). The rejected
//    statement's dimension gets -1; the other three shown each get +1/3 —
//    this sums to 0 per block, same as the old most+least design, but via
//    an asymmetric 1-vs-3 split rather than a symmetric +1/-1 pair. Under a
//    uniformly random "least" pick, the expected contribution per
//    appearance is 1/4·(-1) + 3/4·(1/3) = 0, preserving the "neutral prior
//    = 0" convention `translateDimensionVectors` and the consistency
//    scoring both assume. A naive "+1 flat to the other three" alternative
//    was considered and rejected: its random-pick expectation is +0.5,
//    which would systematically bias every dimension positive regardless
//    of actual signal.
//    One consequence: the per-dimension raw range across repeated
//    appearances is asymmetric — floor ≈ -1 per appearance (rejected every
//    time shown) vs. ceiling ≈ +1/3 per appearance (never rejected). This
//    is an accepted limitation of least-only ipsative instruments (reject
//    signal is inherently more information-dense per pick than the diffuse
//    positive residual), same "first-pass, unvalidated" caveat tier as the
//    rest of this file. `dimensionVectors` remains valid ONLY for
//    WITHIN-CANDIDATE profile shape (e.g. a radar chart) — never sort,
//    filter, or compare candidates against each other on raw values.
// 2. `manipulationRiskFlag` is computed here but not consumed anywhere in
//    the app yet — it does not currently gate visibility, trust labels, or
//    anything else. Wiring it up is future work.

import { ASSESSMENT_DIMENSIONS, type AssessmentDimension } from '@/lib/constants/onboarding'

export const PAIR_VARIANCE_THRESHOLD = 1.5 // per-dimension quad-vs-Likert variance that counts as a contradiction
export const MANIPULATION_FLAG_THRESHOLD = 1.8 // aggregate inconsistencyScore that sets manipulationRiskFlag

export interface QuadStatementMeta {
  id: string
  blockId: string
  dimension: string
  pole: string // "high" | "low"
}

export interface LikertItemMeta {
  id: string
  dimension: string
  pole: string // "high" | "low"
  isReversed: boolean
  pairedQuadDimension: string
}

export interface QuadResponseInput {
  blockId: string
  leastLikeMe: string
}

export interface LikertResponseInput {
  itemId: string
  score: number // 1-5
}

export type DimensionVectors = Record<AssessmentDimension, number>

export interface InconsistencyPair {
  dimension: AssessmentDimension
  quadValue: number
  likertValue: number
  delta: number
}

/**
 * Blended -1..+1-ish vector per dimension: quad-block "least like me"
 * rejection (-1 to the rejected dimension, +1/3 to each of the other three
 * shown) plus Likert response (reverse-scored via isReversed, normalized to
 * -1..+1) added at 0.5 weight into the SAME vector. computeInconsistency
 * below re-derives its own per-source signals independently for
 * cross-validation.
 */
export function computeDimensionVectors(
  quadResponses: QuadResponseInput[],
  quadStatements: QuadStatementMeta[],
  likertResponses: LikertResponseInput[],
  likertItems: LikertItemMeta[]
): DimensionVectors {
  const statementById = new Map(quadStatements.map((s) => [s.id, s]))
  const itemById = new Map(likertItems.map((i) => [i.id, i]))
  const statementsByBlock = new Map<string, QuadStatementMeta[]>()
  for (const statement of quadStatements) {
    const existing = statementsByBlock.get(statement.blockId) ?? []
    existing.push(statement)
    statementsByBlock.set(statement.blockId, existing)
  }

  const vectors = {} as DimensionVectors
  for (const dim of ASSESSMENT_DIMENSIONS) vectors[dim.key] = 0

  // Layer 1: Quad-block scoring — rejected statement's dimension gets -1,
  // the other three shown in that block each get +1/3.
  for (const response of quadResponses) {
    const blockStatements = statementsByBlock.get(response.blockId) ?? []
    const leastStatement = statementById.get(response.leastLikeMe)
    if (!leastStatement) continue

    vectors[leastStatement.dimension as AssessmentDimension] -= 1
    for (const statement of blockStatements) {
      if (statement.id === leastStatement.id) continue
      vectors[statement.dimension as AssessmentDimension] += 1 / 3
    }
  }

  // Layer 2: Likert scoring, normalized -1..+1, weighted at 50% of a
  // quad-block pick, added into the same vector.
  for (const response of likertResponses) {
    const item = itemById.get(response.itemId)
    if (!item) continue
    const rawScore = item.isReversed ? 6 - response.score : response.score
    const normalized = (rawScore - 3) / 2 // maps 1-5 to -1..+1
    vectors[item.dimension as AssessmentDimension] += normalized * 0.5
  }

  return vectors
}

// Averages the per-appearance contribution (-1 or +1/3) for `dimension`
// across every quad-block where it appeared — an improvement over the old
// first-match approach, necessary now since a single +1/3 appearance alone
// is too weak a signal to compare meaningfully against a Likert response.
function computeAverageQuadSignal(
  quadResponses: QuadResponseInput[],
  quadStatements: QuadStatementMeta[],
  dimension: string
): number | null {
  const statementById = new Map(quadStatements.map((s) => [s.id, s]))
  const statementsByBlock = new Map<string, QuadStatementMeta[]>()
  for (const statement of quadStatements) {
    const existing = statementsByBlock.get(statement.blockId) ?? []
    existing.push(statement)
    statementsByBlock.set(statement.blockId, existing)
  }

  const contributions: number[] = []
  for (const response of quadResponses) {
    const blockStatements = statementsByBlock.get(response.blockId) ?? []
    const shownDimensions = blockStatements.map((s) => s.dimension)
    if (!shownDimensions.includes(dimension)) continue

    const leastStatement = statementById.get(response.leastLikeMe)
    if (!leastStatement) continue

    contributions.push(leastStatement.dimension === dimension ? -1 : 1 / 3)
  }

  if (contributions.length === 0) return null
  return contributions.reduce((sum, c) => sum + c, 0) / contributions.length
}

export function computeInconsistency(
  quadResponses: QuadResponseInput[],
  likertResponses: LikertResponseInput[],
  quadStatements: QuadStatementMeta[],
  likertItems: LikertItemMeta[]
): {
  inconsistencyScore: number
  inconsistencyPairs: InconsistencyPair[]
  manipulationRiskFlag: boolean
  flagThreshold: number | undefined
} {
  const itemById = new Map(likertItems.map((i) => [i.id, i]))
  const inconsistencyPairs: InconsistencyPair[] = []

  for (const likertResponse of likertResponses) {
    const item = itemById.get(likertResponse.itemId)
    if (!item) continue

    const quadAvg = computeAverageQuadSignal(quadResponses, quadStatements, item.pairedQuadDimension)
    if (quadAvg === null) continue

    // Rescale only for this comparison — stretches the compressed +1/3
    // ceiling back out to +1 so PAIR_VARIANCE_THRESHOLD/
    // MANIPULATION_FLAG_THRESHOLD stay valid without recalibration. The
    // rejected (-1) side needs no rescale, it's already at full scale.
    const quadValue = quadAvg > 0 ? quadAvg * 3 : quadAvg

    const likertScore = item.isReversed ? 6 - likertResponse.score : likertResponse.score
    const likertValue = (likertScore - 3) / 2

    const delta = Math.abs(quadValue - likertValue)
    if (delta > PAIR_VARIANCE_THRESHOLD) {
      inconsistencyPairs.push({
        dimension: item.pairedQuadDimension as AssessmentDimension,
        quadValue,
        likertValue,
        delta,
      })
    }
  }

  const totalVariance = inconsistencyPairs.reduce((sum, pair) => sum + pair.delta, 0)
  const inconsistencyScore = totalVariance / Math.max(inconsistencyPairs.length, 1)
  const manipulationRiskFlag = inconsistencyScore > MANIPULATION_FLAG_THRESHOLD

  return {
    inconsistencyScore,
    inconsistencyPairs,
    manipulationRiskFlag,
    flagThreshold: manipulationRiskFlag ? inconsistencyScore : undefined,
  }
}

// Plain-English per-dimension summary for AssessmentResult.translatedOutput —
// never expose the underlying vector numbers or dimension jargon to
// employers, per the "never expose psychometric labels" product rule.
export function translateDimensionVectors(vectors: DimensionVectors): Record<string, string> {
  const translated: Record<string, string> = {}
  for (const dim of ASSESSMENT_DIMENSIONS) {
    const value = vectors[dim.key]
    if (value <= -0.75) translated[dim.key] = `Strongly leans: ${dim.low}`
    else if (value < 0) translated[dim.key] = `Somewhat leans: ${dim.low}`
    else if (value === 0) translated[dim.key] = 'Balanced between both ends'
    else if (value < 0.75) translated[dim.key] = `Somewhat leans: ${dim.high}`
    else translated[dim.key] = `Strongly leans: ${dim.high}`
  }
  return translated
}
