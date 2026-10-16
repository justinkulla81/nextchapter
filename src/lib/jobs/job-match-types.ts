// Types and labels for the per-job match (job-match.ts) — no logic and no heavy imports,
// so client components can render a match without bundling the scorer.

import type { RequirementCheck } from '@/lib/jobs/requirements'

export type MatchDimensionKey = 'skills' | 'culture' | 'salary' | 'goals' | 'workStyle'
export type MatchStatus = 'strong' | 'partial' | 'gap' | 'unknown'
export type OverallMatch = 'strong' | 'good' | 'mixed' | 'weak' | 'unknown'

export interface MatchDimension {
  key: MatchDimensionKey
  /** 0-100; null when unknown. Internal — never rendered. */
  score: number | null
  status: MatchStatus
  /** Short plain-language reasons, most important first. */
  evidence: string[]
  /** When the member could fill a missing input: where to do it. */
  profilePrompt?: { label: string; href: string }
}

export interface JobMatch {
  /** 0-100 weighted over known dimensions; null when fewer than two are known. Internal. */
  overallScore: number | null
  overall: OverallMatch
  dimensions: Record<MatchDimensionKey, MatchDimension>
  /** 2-4 specific, actionable bullets — what to address in this application. */
  gaps: string[]
  /**
   * The job's hard requirements (clearance, citizenship, sponsorship, licenses, travel,
   * relocation, onsite) against the member's answers, blockers first (requirements.ts).
   * A blocker is a red flag; 'unknown' means the member hasn't answered (shown neutrally
   * with a link to answer). Empty when the job states none.
   */
  requirements: RequirementCheck[]
}

export const MATCH_DIMENSION_ORDER: MatchDimensionKey[] = ['skills', 'culture', 'salary', 'goals', 'workStyle']
export const MATCH_DIMENSION_LABEL: Record<MatchDimensionKey, string> = {
  skills: 'Skills',
  culture: 'Culture',
  salary: 'Salary',
  goals: 'Goals',
  workStyle: 'Working style',
}
export const OVERALL_MATCH_LABEL: Record<OverallMatch, string> = {
  strong: 'Strong match',
  good: 'Good match',
  mixed: 'Mixed match',
  weak: 'Weak match',
  unknown: 'Match unclear',
}
export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  strong: 'Strong',
  partial: 'Partial',
  gap: 'Gap',
  unknown: 'Unknown',
}

