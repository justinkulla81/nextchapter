// Scoring for the "How I Perform" self-report (Assessment Layer spec Part 3).
// Deliberately simple compared to assessment-vectors.ts (no ipsative
// quad-block, no cross-validation) — this is a flat 4-point agreement scale,
// reverse-scored items flipped, averaged per dimension. Mirrors the anchored
// 1-4 scale convention already established for the Reference Check
// (src/lib/references/anchored-scale.ts) so self- and reference-rated scores
// stay comparable on the same 1-4 axis.

import {
  HOW_I_PERFORM_ITEMS,
  PERFORMANCE_DIMENSION_ORDER,
  type PerformanceDimension,
} from '@/lib/constants/how-i-perform-items'

export interface PerformanceResponseInput {
  itemId: number
  score: 1 | 2 | 3 | 4
}

export interface PerformanceDimensionScores {
  execution: number
  judgment: number
  composure: number
  influence: number
  integrity: number
}

const ITEM_BY_ID = new Map(HOW_I_PERFORM_ITEMS.map((item) => [item.id, item]))

// Flips a raw 1-4 response for reverse-scored items so every item's scored
// value points the same direction (4 = the strong-performance end).
function scoredValue(itemId: number, raw: number): number {
  const item = ITEM_BY_ID.get(itemId)
  if (!item) return raw
  return item.isReversed ? 5 - raw : raw
}

const DIMENSION_FIELD: Record<PerformanceDimension, keyof PerformanceDimensionScores> = {
  EXECUTION: 'execution',
  JUDGMENT: 'judgment',
  COMPOSURE: 'composure',
  INFLUENCE: 'influence',
  INTEGRITY: 'integrity',
}

// Computes the 1-4 mean per dimension. Missing items for a dimension fall
// back to the scale midpoint-ish 2.5 rather than throwing — the submission
// action validates all 40 are present before calling this, but this stays
// defensive since PerformanceAssessmentResponse.responses is untyped JSON.
export function computePerformanceScores(
  responses: PerformanceResponseInput[]
): PerformanceDimensionScores {
  const byId = new Map(responses.map((r) => [r.itemId, r.score]))
  const scores = {} as PerformanceDimensionScores

  for (const dimension of PERFORMANCE_DIMENSION_ORDER) {
    const items = HOW_I_PERFORM_ITEMS.filter((i) => i.dimension === dimension)
    const values = items
      .filter((item) => byId.has(item.id))
      .map((item) => scoredValue(item.id, byId.get(item.id)!))
    const mean = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 2.5
    scores[DIMENSION_FIELD[dimension]] = mean
  }

  return scores
}
