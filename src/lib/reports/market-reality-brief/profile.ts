// The competency profile: every dimension the resume analysis scores, in the
// groups a reviewer thinks in, each with a rating, what a reviewer reads off
// it, and the single most valuable observation. Pure; the scores and
// findings are the analysis's own, so nothing here is a second opinion.

import { DIMENSION_LABEL, DIMENSION_ORDER, type DimensionKey } from '@/lib/scoring/resume-analysis/types'
import type { Assessment } from './types'

export const STRENGTH_AT = 75
export const ADEQUATE_AT = 50

export interface ProfileRow {
  key: DimensionKey
  label: string
  assessment: Assessment
  /** 0-100, for the scale chart only. Never printed as a number. */
  score: number
  /** What a reviewer reads off this dimension. */
  reads: string
  /** The most valuable observation, from the analysis's own finding; null when nothing is flagged. */
  observation: string | null
}

export interface ProfileGroup {
  title: string
  rows: ProfileRow[]
}

const GROUPS: { title: string; keys: DimensionKey[] }[] = [
  { title: 'Positioning and proof', keys: ['narrativePositioning', 'quantification', 'scopeLevel'] },
  { title: 'Trajectory and stability', keys: ['trajectory', 'tenurePattern', 'employmentGaps', 'relevanceRecency'] },
  { title: 'Coherence', keys: ['industryCoherence', 'functionTrackConsistency'] },
  { title: 'Currency', keys: ['skillCurrency'] },
  { title: 'Findability and finish', keys: ['atsLegibility', 'contactability', 'mechanicsPresentation'] },
]

const READS: Record<DimensionKey, string> = {
  narrativePositioning: 'Whether the page says what role you want and what you are known for.',
  quantification: 'Whether the size of your results can be read without guessing.',
  scopeLevel: 'Whether the scope matches the level you are targeting.',
  trajectory: 'Whether the career moves up, sideways or down, and how fast.',
  tenurePattern: 'Whether you stay long enough to deliver, and how short stints read.',
  employmentGaps: 'Whether time between roles is accounted for.',
  relevanceRecency: 'Whether the work most like the target is recent.',
  industryCoherence: 'Whether the industries add up to a story or look like drift.',
  functionTrackConsistency: 'Whether the function stays consistent, or the track jumps.',
  skillCurrency: 'Whether the vocabulary and tools are current for the role today.',
  atsLegibility: 'Whether screening software can read the file at all.',
  contactability: 'Whether a recruiter can reach you in one step.',
  mechanicsPresentation: 'Whether the document is clean, consistent and error-free.',
}

export function ratingFor(score: number): Assessment {
  return score >= STRENGTH_AT ? 'strength' : score >= ADEQUATE_AT ? 'adequate' : 'development'
}

export function buildProfile(
  scores: Partial<Record<string, number>> | null,
  findings: Partial<Record<string, { candidateFacingCopy: string; estimatedPointGain: number }[]>> | null
): ProfileGroup[] {
  if (!scores) return []
  const known = new Set<string>(DIMENSION_ORDER)
  return GROUPS.map((g) => ({
    title: g.title,
    rows: g.keys
      .filter((k) => known.has(k) && typeof scores[k] === 'number')
      .map((k) => {
        const top = [...(findings?.[k] ?? [])].sort((a, b) => b.estimatedPointGain - a.estimatedPointGain)[0]
        return {
          key: k,
          label: DIMENSION_LABEL[k],
          assessment: ratingFor(scores[k]!),
          score: scores[k]!,
          reads: READS[k],
          observation: top && top.estimatedPointGain > 0 ? top.candidateFacingCopy : null,
        }
      }),
  })).filter((g) => g.rows.length > 0)
}
