// Composite grade — Master Build Script §3.6/§3.5/§3.7, superseding the
// Phase 4 four-component version. Key differences from that version:
//   - Five components, not four: Experience/Resume (the old "Record" split
//     in two) plus Evidence and Effort — weighted per §3.4's band-dependent
//     config (composite-weights.config.ts).
//   - Market is never weighted — it applies as a one-band cap (§3.5): the
//     composite grade may never exceed Market's own band by more than one.
//   - Measured-only, proportionally reweighted (§3.6): the composite
//     computes over whichever weighted components have real data, scaling
//     their weights up to fill the gap, rather than requiring all four
//     non-null or returning null entirely. A day-one candidate with zero
//     Evidence and zero Effort is graded on Experience + Resume alone —
//     the grade gets more complete over time, it doesn't climb out of a
//     hole. Returns null only when NOTHING is measured yet.
// There is exactly one headline grade — per the user's original
// correction, preserved from the Phase 4 version: "There is no second
// headline number. Difficulty is not separate from it. Difficulty is the
// Market Reality Grade."

import 'server-only'
import { prisma } from '@/lib/prisma'
import { scoreToGrade, type Grade } from '@/lib/scoring/grade'
import { getComponentWeights, type WeightedComponent } from './composite-weights.config'
import type { SeniorityBand } from '../resume-analysis/types'

export type MarketRealityComponent = WeightedComponent | 'MARKET'

export interface MarketRealityComposite {
  compositeScore: number
  grade: Grade
  drivingComponent: MarketRealityComponent
  // Market is never "strongest" — it's a cap, not a competitor among the
  // weighted four (§3.5). It CAN be "driving" when it's the thing capping
  // the grade — that's the one case where it takes the driving slot.
  strongestComponent: WeightedComponent
  cappedByMarket: boolean
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

const GRADE_ORDER: Grade[] = ['F', 'D', 'C', 'B', 'A']
const GRADE_MAX_SCORE: Record<Grade, number> = { F: 19, D: 39, C: 74, B: 89, A: 100 }

function oneGradeAbove(grade: Grade): Grade {
  const idx = GRADE_ORDER.indexOf(grade)
  return GRADE_ORDER[Math.min(GRADE_ORDER.length - 1, idx + 1)]
}

// Computes and persists the composite from whatever component scores are
// already on the row (does NOT recompute the components themselves — call
// the Phase 2/3 compute functions first).
export async function computeMarketRealityCompositeGrade(candidateId: string): Promise<MarketRealityComposite | null> {
  const [row, latestResumeAnalysis] = await Promise.all([
    prisma.marketRealityComponentScore.findUnique({ where: { candidateId } }),
    prisma.resumeAnalysis.findFirst({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      select: { seniorityBand: true },
    }),
  ])
  if (!row) return null

  const weights = getComponentWeights((latestResumeAnalysis?.seniorityBand as SeniorityBand | undefined) ?? null)
  const allScores: Record<WeightedComponent, number | null> = {
    EXPERIENCE: row.experienceScore,
    RESUME: row.resumeScore,
    EVIDENCE: row.evidenceScore,
    EFFORT: row.effortScore,
  }

  const measured = (Object.keys(allScores) as WeightedComponent[]).filter((key) => allScores[key] !== null)
  if (measured.length === 0) return null // nothing measured yet at all — never grade off zeros

  const totalWeight = measured.reduce((sum, key) => sum + weights[key], 0)
  const weightedSum = measured.reduce((sum, key) => sum + (allScores[key] as number) * weights[key], 0)
  let compositeScore = clamp(weightedSum / totalWeight)

  // Market cap (§3.5) — the composite grade may never exceed Market's own
  // band by more than one. Cap the SCORE, not just the displayed grade, so
  // the two can never drift apart (the exact class of bug §8's self-check
  // requirement exists to catch).
  let cappedByMarket = false
  if (row.marketScore !== null) {
    const marketGrade = scoreToGrade(row.marketScore)
    const maxAllowedScore = GRADE_MAX_SCORE[oneGradeAbove(marketGrade)]
    if (compositeScore > maxAllowedScore) {
      compositeScore = maxAllowedScore
      cappedByMarket = true
    }
  }

  const grade = scoreToGrade(compositeScore)

  const strongestComponent = measured.reduce((best, key) =>
    (allScores[key] as number) > (allScores[best] as number) ? key : best
  )
  // Driving = Market when it's the thing capping the grade — that's the
  // whole point of a cap, and the headline (narrative.ts) must name it, not
  // bury it behind whichever weighted component happens to score lowest.
  // Otherwise, driving = the measured component whose weighted shortfall
  // from 100 is largest — not simply the lowest raw score, since a
  // low-weight component scoring low shouldn't outrank a high-weight
  // component scoring moderately low.
  const drivingComponent: MarketRealityComponent = cappedByMarket
    ? 'MARKET'
    : measured.reduce((worst, key) =>
        (100 - (allScores[key] as number)) * weights[key] > (100 - (allScores[worst] as number)) * weights[worst]
          ? key
          : worst
      )

  await prisma.marketRealityComponentScore.update({
    where: { candidateId },
    data: { compositeScore, grade, drivingComponent, strongestComponent },
  })

  return { compositeScore, grade, drivingComponent, strongestComponent, cappedByMarket }
}
