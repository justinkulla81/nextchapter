// Pure types/values for the Market Reality Grade and Search Action Grade —
// no server-only dependencies,
// so client components (e.g. the animated score-reveal ring) can import
// these directly without pulling in the Prisma/market-data computation in
// hireability-grade.ts.

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'
export type FactorType = 'controllable' | 'influenceable' | 'structural'

export function scoreToGrade(score: number): Grade {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 50) return 'C'
  if (score >= 30) return 'D'
  return 'F'
}

export const GRADE_LABEL: Record<Grade, string> = {
  A: 'Excellent',
  B: 'Good',
  C: 'Average',
  D: 'Needs work',
  F: 'Critical gap',
}

// Deliberately no raw numbers shown anywhere in the product — a number
// like "62/100" reads as more precise than the underlying signals actually
// are. The letter grade plus this band description is the whole story.
export const GRADE_BAND_DESCRIPTION: Record<Grade, string> = {
  A: 'Excellent — at or near the top of what this dimension can show',
  B: 'Good — solid, with room to sharpen',
  C: 'Average — a real gap worth closing',
  D: 'Needs work — this is actively holding you back',
  F: 'Critical gap — the single highest-leverage thing to fix',
}

export const FACTOR_TYPE_LABEL: Record<FactorType, string> = {
  controllable: 'Controllable',
  influenceable: 'Influenceable',
  structural: 'Structural',
}

export const FACTOR_TYPE_EXPLANATION: Record<FactorType, string> = {
  controllable: "Fully in your hands. This is where effort converts most directly into a better grade.",
  influenceable: 'You can shift it, but it also depends on things you already brought with you — like your work history.',
  structural: "Mostly outside your control. It reflects real market/role conditions, not effort — don't blame yourself for a low grade here.",
}

export const MARKET_REALITY_DIMENSION_EXPLANATION: Record<MarketRealityDimension['key'], string> = {
  experienceMatch: 'Whether your background — years, level, title — actually lines up with the role you\'re targeting.',
  marketPosition: 'Real hiring demand for your role and location, from labor-market data — not something you can change by trying harder.',
  targetComplexity: "How big a leap your target is from your current function and industry. A same-function, same-industry target is the easiest case.",
  presentation: 'How well your resume, LinkedIn, and story come across on paper — the first impression before anyone talks to you.',
  socialProof: 'Completed references and work samples — real people and real evidence vouching for you, not just your own word.',
  searchStrategy: 'How intensively and flexibly you\'re approaching the search itself — your stated intensity, flexibility, and follow-through on setup steps.',
}

export const SEARCH_EXECUTION_ENGINE_EXPLANATION: Record<SearchExecutionEngine['key'], string> = {
  learning: "Whether you've done the foundational work — a complete profile, the How I Work Best assessment, a real target defined.",
  effort: "How many of your action-plan confirmations you've actually completed, plus jobs you've run through fit feedback.",
  working: 'Real assets you\'ve built — a resume on file, work samples, active LinkedIn posting.',
  connecting: "Real outreach and network signals — your networking list, references requested, and community engagement.",
}

// Static labels/factor-types for the system explainer — the live computed
// grade already carries a label+factorType per dimension, but the explainer
// describes the system in the abstract, without a candidate's grade in hand.
export const MARKET_REALITY_DIMENSION_LABEL: Record<MarketRealityDimension['key'], string> = {
  experienceMatch: 'Experience Match',
  marketPosition: 'Market Position',
  targetComplexity: 'Target Complexity',
  presentation: 'Presentation',
  socialProof: 'Social Proof',
  searchStrategy: 'Search Strategy',
}

export const MARKET_REALITY_DIMENSION_FACTOR_TYPE: Record<MarketRealityDimension['key'], FactorType> = {
  experienceMatch: 'influenceable',
  marketPosition: 'structural',
  targetComplexity: 'structural',
  presentation: 'controllable',
  socialProof: 'controllable',
  searchStrategy: 'controllable',
}

export const SEARCH_EXECUTION_ENGINE_LABEL: Record<SearchExecutionEngine['key'], string> = {
  learning: 'Learning',
  effort: 'Effort',
  working: 'Working',
  connecting: 'Connecting',
}

// How much real signal backs a dimension's grade today, separate from the
// grade itself — a candidate should be able to tell "this is confirmed by
// real data" apart from "this is our best guess so far." Improves as the
// candidate reveals more (job reactions, resume/LinkedIn completion, etc.),
// independent of whether the grade itself goes up or down.
export type ConfidenceLevel = 'HIGH' | 'BUILDING' | 'PROVISIONAL'

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  HIGH: 'Confirmed',
  BUILDING: 'Building',
  PROVISIONAL: 'Provisional',
}

export const CONFIDENCE_EXPLANATION: Record<ConfidenceLevel, string> = {
  HIGH: 'Backed by confirmed, verifiable data.',
  BUILDING: "Real, but still filling in — it'll sharpen as you add more signal.",
  PROVISIONAL: "Our best early read — treat it as a starting point, not a verdict.",
}

// Tailwind classes for the small confidence pill shown next to each Market
// Reality dimension — deliberately quieter than the grade color itself,
// since confidence is metadata about the grade, not a second grade.
export const CONFIDENCE_STYLE: Record<ConfidenceLevel, string> = {
  HIGH: 'bg-success/10 text-success',
  BUILDING: 'bg-brand/10 text-brand',
  PROVISIONAL: 'bg-muted text-muted-foreground',
}

export interface MarketRealityDimension {
  key: 'experienceMatch' | 'marketPosition' | 'targetComplexity' | 'presentation' | 'socialProof' | 'searchStrategy'
  label: string
  score: number
  grade: Grade
  factorType: FactorType
  confidence: ConfidenceLevel
}

export interface SearchExecutionEngine {
  key: 'learning' | 'effort' | 'working' | 'connecting'
  label: string
  score: number
  grade: Grade
}

// From this week onward, an A requires every engine to individually clear a
// floor score — you can't earn an A by maxing one engine while neglecting
// the others. Below this week, a single strong engine can still carry the
// grade, since there's been no time yet to build all four out.
export const CATEGORY_MINIMUM_ENFORCED_FROM_WEEK = 4
export const CATEGORY_MINIMUM_SCORE_FLOOR = 50 // grade C

export interface HireabilityGrade {
  marketReality: { score: number; grade: Grade; dimensions: MarketRealityDimension[] }
  searchExecution: {
    score: number
    grade: Grade
    engines: SearchExecutionEngine[]
    categoryMinimumsMet: boolean
    laggingEngines: SearchExecutionEngine['key'][]
    // Real Weekly Search Score points for the current Search Sprint — 1
    // point = 1 minute of effort, shown transparently to the candidate
    // (deliberately not hidden behind the "no raw numbers" convention that
    // applies to the algorithmic grades above, since visible points are the
    // whole point of this system).
    weeklyPoints: number
    weeklyPointsTarget: number
    // Bonus fields, optional since older stored report snapshots predate
    // them (undefined on those rows, never backfilled — historical reports
    // reflect the rules at the time they were generated). hasExecutiveCoach
    // = +25% recognized points; hadPriorWeekA = +10% more, universal to
    // anyone coming off an A week, coach or not. Grade is computed from
    // recognizedWeeklyPoints, not the raw weeklyPoints above.
    bonusMultiplier?: number
    hasExecutiveCoach?: boolean
    hadPriorWeekA?: boolean
    recognizedWeeklyPoints?: number
  }
}
