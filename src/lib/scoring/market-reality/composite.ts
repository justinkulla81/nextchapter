// Composite grade — Market Reality Grade 2.0 Phase 4. Weights the four
// components into ONE headline number, per the user's explicit correction
// that superseded every "two separate headline scores" framing in the
// original specs: "There is no second headline number. Difficulty is not
// separate from it. Difficulty is the Market Reality Grade."
//
// Weights are a first-pass calibration (no real scored population yet to
// fit against — same caveat as grade.ts's own curve), not derived from the
// specs, which never state explicit percentages:
//   RECORD 35 / MARKET 25 / CHANNELS 20 / EVIDENCE 20
// Record leads because it's the fully candidate-controlled, fastest-to-fix
// input (Report Structure Spec §2.2). Market and Channels split the rest of
// the "difficulty" framing from that same section. Evidence carries real
// weight but not the largest share — many candidates will have zero
// completed references early on, and that's an honest, not a padded,
// reflection of how little corroboration exists yet.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { scoreToGrade, type Grade } from '@/lib/scoring/grade'

export type MarketRealityComponent = 'RECORD' | 'EVIDENCE' | 'MARKET' | 'CHANNELS'

const WEIGHTS: Record<MarketRealityComponent, number> = {
  RECORD: 0.35,
  MARKET: 0.25,
  CHANNELS: 0.2,
  EVIDENCE: 0.2,
}

export interface MarketRealityComposite {
  compositeScore: number
  grade: Grade
  drivingComponent: MarketRealityComponent
  strongestComponent: MarketRealityComponent
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

// Computes and persists the composite from whatever component scores are
// already on the row (does NOT recompute the components themselves — call
// the Phase 2/3 compute functions first). Returns null if any component is
// still unscored: a partial composite would misrepresent difficulty as
// computed when it's actually just missing data (Voice/Intake Spec §1.4 —
// the resume grade can be shown provisionally, but the difficulty estimate
// cannot).
export async function computeMarketRealityCompositeGrade(candidateId: string): Promise<MarketRealityComposite | null> {
  const row = await prisma.marketRealityComponentScore.findUnique({ where: { candidateId } })
  if (!row || row.recordScore === null || row.evidenceScore === null || row.marketScore === null || row.channelsScore === null) {
    return null
  }

  const scores: Record<MarketRealityComponent, number> = {
    RECORD: row.recordScore,
    EVIDENCE: row.evidenceScore,
    MARKET: row.marketScore,
    CHANNELS: row.channelsScore,
  }

  const compositeScore = clamp(
    (Object.keys(scores) as MarketRealityComponent[]).reduce((sum, key) => sum + scores[key] * WEIGHTS[key], 0)
  )
  const grade = scoreToGrade(compositeScore)

  const components = Object.keys(scores) as MarketRealityComponent[]
  // Driving = the component whose weighted shortfall from 100 is largest —
  // not simply the lowest raw score, since a low-weight component scoring
  // low shouldn't outrank a high-weight component scoring moderately low.
  const drivingComponent = components.reduce((worst, key) =>
    (100 - scores[key]) * WEIGHTS[key] > (100 - scores[worst]) * WEIGHTS[worst] ? key : worst
  )
  const strongestComponent = components.reduce((best, key) => (scores[key] > scores[best] ? key : best))

  await prisma.marketRealityComponentScore.update({
    where: { candidateId },
    data: { compositeScore, grade, drivingComponent, strongestComponent },
  })

  return { compositeScore, grade, drivingComponent, strongestComponent }
}
