// Shared types for the Record component (Market Reality Grade 2.0) —
// no server-only dependencies here, so client components can import the
// plain types without pulling in Prisma/Anthropic.

export type SeniorityBand = 'EARLY' | 'MID' | 'SENIOR' | 'EXECUTIVE'

export type FunctionFamily =
  | 'REVENUE'
  | 'MARKETING'
  | 'ENGINEERING'
  | 'PRODUCT'
  | 'FINANCE'
  | 'OPERATIONS'
  | 'PEOPLE'
  | 'LEGAL'
  | 'CLINICAL'
  | 'GENERAL_MANAGEMENT'

export type DimensionKey =
  | 'evidenceQuality'
  | 'narrativePositioning'
  | 'atsLegibility'
  | 'scopeLevel'
  | 'trajectory'
  | 'mechanicsPresentation'
  | 'tenurePattern'
  | 'relevanceRecency'
  | 'skillCurrency'
  | 'contactability'

export const DIMENSION_ORDER: DimensionKey[] = [
  'evidenceQuality',
  'narrativePositioning',
  'atsLegibility',
  'scopeLevel',
  'trajectory',
  'mechanicsPresentation',
  'tenurePattern',
  'relevanceRecency',
  'skillCurrency',
  'contactability',
]

export const DIMENSION_LABEL: Record<DimensionKey, string> = {
  evidenceQuality: 'Evidence Quality',
  narrativePositioning: 'Narrative & Positioning',
  atsLegibility: 'ATS Legibility & File Hygiene',
  scopeLevel: 'Scope & Level',
  trajectory: 'Trajectory',
  mechanicsPresentation: 'Mechanics & Presentation',
  tenurePattern: 'Tenure Pattern',
  relevanceRecency: 'Relevance & Recency',
  skillCurrency: 'Skill & Vocabulary Currency',
  contactability: 'Contactability',
}

export interface Finding {
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  candidateFacingCopy: string
  fix: string
  estimatedPointGain: number
}

export type DimensionScores = Record<DimensionKey, number>
export type DimensionFindings = Record<DimensionKey, Finding[]>

export const RESUME_BANDS = [
  { band: 'A', min: 90, label: 'Exceptional' },
  { band: 'A-', min: 85, label: 'Strong' },
  { band: 'B+', min: 80, label: 'Good' },
  { band: 'B', min: 74, label: 'Solid' },
  { band: 'B-', min: 68, label: 'Adequate' },
  { band: 'C+', min: 62, label: 'Mixed' },
  { band: 'C', min: 55, label: 'Needs work' },
  { band: 'D', min: 40, label: 'Significant gaps' },
  { band: 'F', min: 0, label: 'Not competitive as written' },
] as const

export type ResumeBand = (typeof RESUME_BANDS)[number]['band']

export function scoreToResumeBand(composite: number): ResumeBand {
  for (const { band, min } of RESUME_BANDS) {
    if (composite >= min) return band
  }
  return 'F'
}

export const RESUME_BAND_LABEL: Record<ResumeBand, string> = Object.fromEntries(
  RESUME_BANDS.map((b) => [b.band, b.label])
) as Record<ResumeBand, string>

export type FirstGlanceResult = 'PASS' | 'BORDERLINE' | 'LIKELY_SKIP'

export type ReviewerDetectionType =
  | 'UNEXPLAINED_RECENT_GAP'
  | 'UNEXPLAINED_CURRENT_GAP'
  | 'SHORT_TENURE_RECENT'
  | 'SHORT_TENURE_CLUSTER'
  | 'SCOPE_DECREASE'
  | 'THIN_RECENT_ENTRY'
  | 'EXTENDED_TENURE_NO_CHANGE'
  | 'TITLE_INFLATION'
  | 'OVERLAPPING_ROLES'
  | 'CREDENTIAL_NO_INSTITUTION'
  | 'PORTFOLIO_CAREER'
  | 'COMP_FIT_RISK'

// Spec §7 — one entry per detection type: what a reviewer notices, the
// candidate-facing follow-up prompt shown as the Search Action Task, and
// the suggested one-line response register (never "this is a problem").
export const REVIEWER_DETECTION_FOLLOWUP: Record<ReviewerDetectionType, string> = {
  UNEXPLAINED_RECENT_GAP: 'Add a one-line reason for this gap',
  UNEXPLAINED_CURRENT_GAP: 'Add your current status and what you’re targeting',
  SHORT_TENURE_RECENT: 'Explain the short tenure at this role',
  SHORT_TENURE_CLUSTER: 'Explain the recent sequence of moves',
  SCOPE_DECREASE: 'Add context for this move',
  THIN_RECENT_ENTRY: 'Add 2–3 specific engagements with outcomes',
  EXTENDED_TENURE_NO_CHANGE: 'Note scope growth within the role, or why you stayed',
  TITLE_INFLATION: 'Add scope numbers that support the title',
  OVERLAPPING_ROLES: 'Clarify which was full-time',
  CREDENTIAL_NO_INSTITUTION: 'Add the granting institution',
  PORTFOLIO_CAREER: 'State that you’re seeking a full-time operating role',
  COMP_FIT_RISK: 'Add a line on why this level and this next chapter',
}
