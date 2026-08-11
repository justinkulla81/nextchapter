// Scoring for the frozen "How I Work Best" rebuild (Assessment Layer spec
// Part 2) — Likert-only, 4-point agreement scale, no quad-block ipsative
// layer. Deliberately a NEW, separate function from computeDimensionVectors
// in assessment-vectors.ts, which stays untouched to keep interpreting the
// one archived rotationGroup-2 response (quad+Likert blend on a 1-5 scale —
// a structurally different instrument, not something this can share code
// with cleanly). See CURRENT_ASSESSMENT_ROTATION_GROUP for which rotation a
// given response belongs to.

import {
  HOW_I_WORK_BEST_ITEMS,
  WORK_STYLE_DIMENSION_ORDER,
  WORK_STYLE_DIMENSION_POLES,
  type WorkStyleDimension,
} from '@/lib/constants/how-i-work-best-items'

export interface WorkStyleResponseInput {
  itemId: number
  score: 1 | 2 | 3 | 4
}

const ITEM_BY_ID = new Map(HOW_I_WORK_BEST_ITEMS.map((item) => [item.id, item]))

// Maps a 1-4 raw response to -1..+1, reverse-scored items flipped first.
// Unlike assessment-vectors.ts's 1-5 quad-compatible normalization
// ((score-3)/2), a 4-point scale has no midpoint — (score-2.5)/1.5 spans
// the full -1..+1 range evenly (1→-1, 2→-1/3, 3→+1/3, 4→+1).
function normalizedValue(itemId: number, raw: number): number {
  const item = ITEM_BY_ID.get(itemId)
  const scored = item?.isReversed ? 5 - raw : raw
  return (scored - 2.5) / 1.5
}

// Lowercased dimension keys (velocity, definition, ...) so the output slots
// into the same Record<string, number> shape CandidateAssessmentResponse
// .dimensionVectors already stores for the legacy instrument — downstream
// readers (self-awareness.ts, translateDimensionVectors) key by string, not
// by a fixed enum, so no type change is needed there.
export function computeWorkStyleVectors(responses: WorkStyleResponseInput[]): Record<string, number> {
  const byId = new Map(responses.map((r) => [r.itemId, r.score]))
  const vectors: Record<string, number> = {}

  for (const dimension of WORK_STYLE_DIMENSION_ORDER) {
    const items = HOW_I_WORK_BEST_ITEMS.filter((i) => i.dimension === dimension)
    const values = items.filter((item) => byId.has(item.id)).map((item) => normalizedValue(item.id, byId.get(item.id)!))
    const mean = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0
    vectors[dimension.toLowerCase() as Lowercase<WorkStyleDimension>] = mean
  }

  return vectors
}

// Plain-English per-dimension summary, mirroring assessment-vectors.ts's
// translateDimensionVectors but reading the new 7-dimension pole labels —
// never expose the underlying vector numbers or "Velocity"/"Definition"
// jargon to employers, same rule as the legacy instrument.
export function translateWorkStyleVectors(vectors: Record<string, number>): Record<string, string> {
  const translated: Record<string, string> = {}
  for (const dimension of WORK_STYLE_DIMENSION_ORDER) {
    const key = dimension.toLowerCase()
    const value = vectors[key] ?? 0
    const { low, high } = WORK_STYLE_DIMENSION_POLES[dimension]
    if (value <= -0.75) translated[key] = `Strongly leans: ${low}`
    else if (value < 0) translated[key] = `Somewhat leans: ${low}`
    else if (value === 0) translated[key] = 'Balanced between both ends'
    else if (value < 0.75) translated[key] = `Somewhat leans: ${high}`
    else translated[key] = `Strongly leans: ${high}`
  }
  return translated
}
