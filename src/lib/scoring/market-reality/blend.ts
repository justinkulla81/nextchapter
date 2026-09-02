// Pure, dependency-free market-reality composite blend-and-cap math — no
// 'server-only', no Prisma. Extracted out of composite.ts (which still owns
// the Prisma orchestration) for two reasons: (1) it's the single source of
// truth for the market-cap boundary table, eliminating the hand-copied
// duplicate of grade.ts's scoreToGrade cutoffs that used to live directly in
// composite.ts and could silently drift out of sync with it; (2) this exact
// logic needs to be importable from a plain Node script (the grade-
// recalibration verification script) — composite.ts's own top-level
// 'server-only' import throws immediately outside a Next/React-Server
// module context, so anything defined inside that file, even an otherwise
// pure function, is unreachable from a raw script.

import { scoreToGrade, type Grade } from '@/lib/scoring/grade'
import type { WeightedComponent } from './composite-weights.config'

export type MarketRealityComponent = WeightedComponent | 'MARKET'

export interface BlendAndCapResult {
  compositeScore: number
  grade: Grade
  cappedByMarket: boolean
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

const GRADE_ORDER: Grade[] = ['F', 'D', 'C', 'B', 'A']

// One below each of scoreToGrade's own floors (grade.ts) — the single copy
// of this boundary table. Update in lockstep with any future edit to
// scoreToGrade; nothing else should re-derive or duplicate it.
export const GRADE_MAX_SCORE: Record<Grade, number> = { F: 14, D: 34, C: 59, B: 84, A: 100 }

export function oneGradeAbove(grade: Grade): Grade {
  const idx = GRADE_ORDER.indexOf(grade)
  return GRADE_ORDER[Math.min(GRADE_ORDER.length - 1, idx + 1)]
}

// Weighted blend of whatever components are measured (proportionally
// reweighted — Master Build Script §3.6), then Market applied as a one-band
// cap, never a weight (§3.5). Returns null only when nothing is measured at
// all — never grade off zeros.
export function blendAndCap(
  scores: Partial<Record<WeightedComponent, number | null | undefined>>,
  weights: Record<WeightedComponent, number>,
  marketScore: number | null
): BlendAndCapResult | null {
  const measured = (Object.keys(scores) as WeightedComponent[]).filter(
    (key) => scores[key] !== null && scores[key] !== undefined
  )
  if (measured.length === 0) return null

  const totalWeight = measured.reduce((sum, key) => sum + weights[key], 0)
  const weightedSum = measured.reduce((sum, key) => sum + (scores[key] as number) * weights[key], 0)
  let compositeScore = clamp(weightedSum / totalWeight)

  let cappedByMarket = false
  if (marketScore !== null) {
    const marketGrade = scoreToGrade(marketScore)
    const maxAllowedScore = GRADE_MAX_SCORE[oneGradeAbove(marketGrade)]
    if (compositeScore > maxAllowedScore) {
      compositeScore = maxAllowedScore
      cappedByMarket = true
    }
  }

  return { compositeScore, grade: scoreToGrade(compositeScore), cappedByMarket }
}
