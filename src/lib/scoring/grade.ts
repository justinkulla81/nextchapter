// Pure types/values for the Hireability Grade — no server-only dependencies,
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

export interface MarketRealityDimension {
  key: 'experienceMatch' | 'marketPosition' | 'targetComplexity' | 'presentation' | 'socialProof' | 'searchStrategy'
  label: string
  score: number
  grade: Grade
  factorType: FactorType
}

export interface SearchExecutionEngine {
  key: 'learning' | 'effort' | 'working' | 'connecting'
  label: string
  score: number
  grade: Grade
}

export interface HireabilityGrade {
  marketReality: { score: number; grade: Grade; dimensions: MarketRealityDimension[] }
  searchExecution: { score: number; grade: Grade; engines: SearchExecutionEngine[] }
}
