import type { HiringCompetencyKey, ScorecardRecommendation } from '@prisma/client'

// Pure, DB-free constants/types — split out of scorecards.ts specifically so
// client components (ScorecardSubmitForm, ScorecardComparisonTable) can
// import these without pulling scorecards.ts's 'server-only' + Prisma-
// touching functions into the browser bundle. Same pattern as
// src/lib/recruiter/submission-stages.ts.
export const COMPETENCY_KEYS: HiringCompetencyKey[] = ['LEADERSHIP', 'SKILLS_EXECUTION', 'COMMUNICATION', 'ADAPTABILITY', 'OWNERSHIP']

export const COMPETENCY_KEY_LABEL: Record<HiringCompetencyKey, string> = {
  LEADERSHIP: 'Leadership & Management',
  SKILLS_EXECUTION: 'Skills & Execution',
  COMMUNICATION: 'Communication & Collaboration',
  ADAPTABILITY: 'Adaptability & Change Readiness',
  OWNERSHIP: 'Ownership & Reliability',
}

export interface CompetencyScoreEntry {
  score: number // 1-5
  notes: string
}

export type CompetencyScores = Partial<Record<HiringCompetencyKey, CompetencyScoreEntry>>

export interface ScorecardComparisonRow {
  panelistName: string
  assignedCompetency: HiringCompetencyKey | null
  submitted: boolean
  overallRecommendation: ScorecardRecommendation | null
  scores: CompetencyScores
}
