import 'server-only'
import type { MarketRealityDimension, FactorType } from '@/lib/scoring/grade'

// Market Reality Grade's structured, individually-referenceable named
// reasons — short, specific, labeled gaps/strengths (not a paragraph of
// prose), each with a stable id so the Executive Dossier can reference
// "which named reason does this section address" and drive its dynamic
// section reweighting (see dossier's closed-loop callout).
export interface NamedReason {
  id: string
  kind: 'gap' | 'strength'
  text: string
  factorType: FactorType
}

const GRADE_TO_SCORE: Record<MarketRealityDimension['grade'], number> = { A: 4, B: 3, C: 2, D: 1, F: 0 }

// Per-dimension gap/strength copy. C-grade dimensions are deliberately
// skipped — not clearly enough a gap or a strength to name with confidence,
// same "don't fabricate a pattern" principle used elsewhere in this scoring
// system (see coach/pre-session-brief.ts's avoidance-pattern heuristic).
const DIMENSION_REASONS: Record<MarketRealityDimension['key'], { gap: string; strength: string }> = {
  experienceMatch: {
    gap: "Experience and target role don't clearly line up yet — worth sharpening how your background maps to what you're going after.",
    strength: 'Strong function/level match for target roles.',
  },
  marketPosition: {
    gap: 'Compensation expectations may sit above current market band for this level.',
    strength: 'Compensation expectations and market position look well-calibrated to your target.',
  },
  targetComplexity: {
    gap: "You're targeting a real pivot — new function and/or industry — which raises the bar versus a lateral move.",
    strength: 'Target role is a natural next step in your existing lane, not a pivot.',
  },
  presentation: {
    gap: 'Resume underrepresents your full scope of impact — recruiters may not see it at a glance.',
    strength: 'Resume and LinkedIn both clearly show your full scope of impact.',
  },
  socialProof: {
    gap: 'Limited third-party evidence so far — few completed references or work samples on file.',
    strength: 'Multiple completed references independently back up your track record.',
  },
  searchStrategy: {
    gap: 'Search strategy could widen the funnel — more flexibility on location, comp, or role would open more doors.',
    strength: "You're running a flexible, well-calibrated search strategy.",
  },
}

const AI_FLUENCY_GAP_ID = 'ai_fluency_gap'
const AI_FLUENCY_STRENGTH_ID = 'ai_fluency_strength'

export function computeNamedReasons(
  dimensions: MarketRealityDimension[],
  aiFluencyExample: string | null
): NamedReason[] {
  const reasons: NamedReason[] = []

  for (const dim of dimensions) {
    const score = GRADE_TO_SCORE[dim.grade]
    const copy = DIMENSION_REASONS[dim.key]
    if (score >= 3) {
      reasons.push({ id: `${dim.key}_strength`, kind: 'strength', text: copy.strength, factorType: dim.factorType })
    } else if (score <= 1) {
      reasons.push({ id: `${dim.key}_gap`, kind: 'gap', text: copy.gap, factorType: dim.factorType })
    }
  }

  // AI Fluency isn't one of the six scored Market Reality dimensions (no
  // reliable signal existed until the "judgment call" capture on the AI
  // project log) — named as a standalone reason rather than forcing it into
  // the fixed six-dimension scoring model.
  if (aiFluencyExample) {
    reasons.push({
      id: AI_FLUENCY_STRENGTH_ID,
      kind: 'strength',
      text: `Concrete evidence of directing AI toward a real judgment call: ${aiFluencyExample}`,
      factorType: 'controllable',
    })
  } else {
    reasons.push({
      id: AI_FLUENCY_GAP_ID,
      kind: 'gap',
      text: 'No visible signal of AI fluency in a function being reshaped by it.',
      factorType: 'controllable',
    })
  }

  return reasons
}
