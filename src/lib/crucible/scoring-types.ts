// Shared types for Crucible's scoring engine — kept separate from
// scoring.ts (the pure functions) and variants.ts (the content) so all
// three can be imported independently without circularity.

// A fixed, universal taxonomy — identical across every variant/discipline,
// so the menu itself never leaks which trap applies (it reads as the
// domain's standard incident-classification vocabulary, not a per-scenario
// hint). See CRUCIBLE_ANSWER_KEYS in variants.ts for which mechanism is
// correct for which variant's planted defect.
export type CrucibleMechanism =
  | 'DATA_LOST_WRONG_NEVER_SAVED'
  | 'CLAIM_FALSE_UNVERIFIABLE'
  | 'SECURITY_PRIVACY_RISK'
  | 'LOGIC_EDGE_CASE_ERROR'
  | 'STYLE_CLUTTER'

export const MECHANISM_OPTIONS: { value: CrucibleMechanism; label: string }[] = [
  { value: 'DATA_LOST_WRONG_NEVER_SAVED', label: 'Data lost, wrong, or never saved' },
  { value: 'CLAIM_FALSE_UNVERIFIABLE', label: 'Claim is false or unverifiable' },
  { value: 'SECURITY_PRIVACY_RISK', label: 'Security or privacy risk' },
  { value: 'LOGIC_EDGE_CASE_ERROR', label: 'Logic or edge-case error' },
  { value: 'STYLE_CLUTTER', label: 'Style or clutter' },
]

export type CrucibleSeverity = 'critical' | 'minor' | 'cosmetic'

export interface CrucibleFlag {
  line: number
  severity: CrucibleSeverity
  mechanism: CrucibleMechanism
  note: string
}

export type CrucibleVerdictValue = 'SHIP' | 'BLOCK' | 'SHIP_WITH_CONDITIONS'

export interface CrucibleAiTools {
  tools: string[]
  bestMove: string
}

export interface CrucibleSubmission {
  flags: CrucibleFlag[]
  verdict: CrucibleVerdictValue
  worstThing: string
  aiTools: CrucibleAiTools | null
}

export type CrucibleDefectDetection = 'exact' | 'near_miss' | 'none'
export type CrucibleHerringOutcome = 'calibrated' | 'ignored' | 'overblocked'

export interface CrucibleScoreBreakdown {
  defectDetection: CrucibleDefectDetection
  defectPoints: number
  verdictPoints: number
  herringOutcome: CrucibleHerringOutcome
  herringPoints: number
  driverBonusEarned: boolean
  driverBonusPoints: number
}

export interface CrucibleScoreResult {
  score: number
  band: string
  branch: 'PASS' | 'GROWTH'
  breakdown: CrucibleScoreBreakdown
  scoringVersion: string
  contentVersion: string
}
