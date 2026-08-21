// Shared types for Crucible's scoring engine — kept separate from
// scoring.ts (the pure QA-judgment scoring), ai-grading.ts (the AI-graded
// prompt/dataset activities), and variants.ts (the content) so all can be
// imported independently without circularity.

// A fixed, universal taxonomy — identical across every variant/discipline —
// tags each checklist option's underlying issue category for analytics.
// Never shown to the candidate directly; the checklist option labels are
// the candidate-facing text (see CrucibleChecklistOption in variants.ts).
export type CrucibleMechanism =
  | 'DATA_LOST_WRONG_NEVER_SAVED'
  | 'CLAIM_FALSE_UNVERIFIABLE'
  | 'SECURITY_PRIVACY_RISK'
  | 'LOGIC_EDGE_CASE_ERROR'
  | 'STYLE_CLUTTER'

export type CrucibleVerdictValue = 'SHIP' | 'BLOCK' | 'SHIP_WITH_CONDITIONS'

export interface CrucibleAiTools {
  tools: string[]
  bestMove: string
}

// ── QA judgment activity (deterministic, no LLM — see scoring.ts) ──
export interface CrucibleQaSubmission {
  selectedOptionIds: string[]
  verdict: CrucibleVerdictValue
}

export type CrucibleDefectDetection = 'exact' | 'none'
export type CrucibleHerringOutcome = 'calibrated' | 'ignored' | 'overblocked'

export interface CrucibleScoreBreakdown {
  defectDetection: CrucibleDefectDetection
  defectPoints: number
  verdictPoints: number
  herringOutcome: CrucibleHerringOutcome
  herringPoints: number
  driverBonusEarned: boolean
  driverBonusPoints: number
  // Populated only once the AI-graded activities have been scored — null
  // until then so a partial (QA-only) score can still be computed/displayed
  // mid-flow without implying the other activities count as zero.
  promptPoints: number | null
  datasetPoints: number | null
}

export interface CrucibleScoreResult {
  score: number
  band: string
  branch: 'PASS' | 'GROWTH'
  breakdown: CrucibleScoreBreakdown
  scoringVersion: string
  contentVersion: string
}

// ── AI-graded activities (prompt-authoring, dataset-analysis) ──
// Real LLM call, not a pure function — see ai-grading.ts. Score is 0-100,
// consistent with the QA activity's own point scale conceptually, but
// summed at a lower weight (see POINTS in scoring.ts).
export interface CrucibleAiGradeResult {
  score: number
  feedback: string
}
