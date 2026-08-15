// Shared types for the Your Experience / Your Resume components (Master
// Build Script §3.1 — the former single "Record" component split in two:
// the career itself vs. the document describing it) — no server-only
// dependencies here, so client components can import the plain types
// without pulling in Prisma/Anthropic.

import type { IssueCode } from '@/lib/analytics/issue-taxonomy'

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

// Renamed from `evidenceQuality` (Master Build Script §3.1/§18) — the old
// name collided with the new "Your Evidence" component, which means
// something entirely different (references/assessments/activity). This
// dimension is document-level quantification, not evidence.
export type DimensionKey =
  | 'quantification'
  | 'narrativePositioning'
  | 'atsLegibility'
  | 'scopeLevel'
  | 'trajectory'
  | 'mechanicsPresentation'
  | 'tenurePattern'
  | 'relevanceRecency'
  | 'industryCoherence'
  | 'skillCurrency'
  | 'contactability'

export const DIMENSION_ORDER: DimensionKey[] = [
  'quantification',
  'narrativePositioning',
  'atsLegibility',
  'scopeLevel',
  'trajectory',
  'mechanicsPresentation',
  'tenurePattern',
  'relevanceRecency',
  'industryCoherence',
  'skillCurrency',
  'contactability',
]

export const DIMENSION_LABEL: Record<DimensionKey, string> = {
  quantification: 'Quantification',
  narrativePositioning: 'Narrative & Positioning',
  atsLegibility: 'ATS Legibility & File Hygiene',
  scopeLevel: 'Scope & Level',
  trajectory: 'Trajectory',
  mechanicsPresentation: 'Mechanics & Presentation',
  tenurePattern: 'Tenure Pattern',
  relevanceRecency: 'Relevance & Recency',
  industryCoherence: 'Industry Coherence',
  skillCurrency: 'Skill & Vocabulary Currency',
  contactability: 'Contactability',
}

// Which of the two components (Master Build Script §3.1) each dimension
// belongs to. Experience = the career itself, scored from stated facts
// (scope, trajectory, tenure, relevance, industry coherence) — "mostly
// fixed." Resume = the document describing that career (ATS legibility,
// quantification, positioning/target line, mechanics, contactability) plus
// skill/vocabulary currency, which the master script doesn't explicitly
// place in either list but is a property of the document's vocabulary, not
// the career — "days" to fix, same fixability class as the rest of Resume.
export type ExperienceResumeComponent = 'EXPERIENCE' | 'RESUME'

export const DIMENSION_COMPONENT: Record<DimensionKey, ExperienceResumeComponent> = {
  scopeLevel: 'EXPERIENCE',
  trajectory: 'EXPERIENCE',
  tenurePattern: 'EXPERIENCE',
  relevanceRecency: 'EXPERIENCE',
  industryCoherence: 'EXPERIENCE',
  atsLegibility: 'RESUME',
  quantification: 'RESUME',
  narrativePositioning: 'RESUME',
  mechanicsPresentation: 'RESUME',
  skillCurrency: 'RESUME',
  contactability: 'RESUME',
}

export interface Finding {
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  candidateFacingCopy: string
  fix: string
  estimatedPointGain: number
  // Stable analytics code — Phase 2 Master Script Part B Prompt 1. Every
  // push-site in dimensions.ts/modifiers.ts must set this; see
  // src/lib/analytics/issue-taxonomy.ts for the registry and the mapping
  // tables (ATS flag kind / mechanics issue kind -> IssueCode) most
  // push-sites should go through rather than hand-picking a literal.
  issueCode: IssueCode
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

// Same thresholds as RESUME_BANDS today, but a separate table — Master
// Build Script §3.4: "these are uncalibrated," and Experience/Resume are
// two independently-fixable components that should be free to diverge in
// calibration once there's a real scored population to regress against.
export const EXPERIENCE_BANDS = [
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

export type ExperienceBand = (typeof EXPERIENCE_BANDS)[number]['band']

export function scoreToExperienceBand(composite: number): ExperienceBand {
  for (const { band, min } of EXPERIENCE_BANDS) {
    if (composite >= min) return band
  }
  return 'F'
}

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

// Guided Resume Walkthrough (§13.1) — "every detection is challengeable
// first," e.g. "We read a gap from March to December. Is that right?" One
// template per detection type, filled from that row's own detectedContext.
// Deliberately phrased as a question the candidate can say "no" to, never
// as a stated defect — a wrong detection must never become a card the
// candidate has to argue with.
export const REVIEWER_DETECTION_CHALLENGE_COPY: Record<ReviewerDetectionType, (context: Record<string, unknown>) => string> = {
  UNEXPLAINED_RECENT_GAP: (c) =>
    `We read a gap of about ${c.gapMonths ?? 'a few'} months between ${c.before ?? 'one role'} and ${c.after ?? 'the next'}. Is that right?`,
  UNEXPLAINED_CURRENT_GAP: (c) =>
    `It looks like your most recent role, ${c.lastRole ?? 'your last role'}, has ended and nothing follows it yet. Is that right?`,
  SHORT_TENURE_RECENT: (c) =>
    `We read about ${c.months ?? 'a short number of'} months at ${c.role ?? 'this role'}${c.company ? ` at ${c.company}` : ''}. Is that right?`,
  SHORT_TENURE_CLUSTER: (c) =>
    `We read a recent run of short stints: ${Array.isArray(c.roles) ? c.roles.join(', ') : 'a few roles close together'}. Is that right?`,
  SCOPE_DECREASE: (c) => `We read your scope narrowing from ${c.from ?? 'your prior role'} to ${c.to ?? 'this one'}. Is that right?`,
  THIN_RECENT_ENTRY: (c) =>
    `Your most recent role, ${c.role ?? 'this role'}${c.company ? ` at ${c.company}` : ''}, has very little detail on it right now. Is that right?`,
  EXTENDED_TENURE_NO_CHANGE: (c) =>
    `We read about ${c.years ?? 'several'} years in ${c.role ?? 'this role'} without a title change. Is that right?`,
  TITLE_INFLATION: (c) =>
    `We read the stated scope at ${c.role ?? 'this role'}${c.company ? ` at ${c.company}` : ''} as notably smaller than that title usually implies. Is that right?`,
  OVERLAPPING_ROLES: (c) => `We read ${c.a ?? 'one role'} and ${c.b ?? 'another role'} as overlapping in time. Is that right?`,
  CREDENTIAL_NO_INSTITUTION: (c) => `We don't see a granting institution listed for your ${c.degree ?? 'degree'}. Is that right?`,
  PORTFOLIO_CAREER: (c) => `We read ${c.count ?? 'several'} concurrent board or advisory seats — a portfolio-style career. Is that right?`,
  COMP_FIT_RISK: (c) => `We read your most recent scope at ${c.role ?? 'this role'} as well above what this target level typically pays. Is that right?`,
}
