// Issue taxonomy — Phase 2 Master Script, Part B, Prompt 1. Every detection
// the scoring engine produces (resume-analysis/dimensions.ts +
// resume-analysis/modifiers.ts's `Finding`-shaped pushes, and
// resume-analysis/reviewer-questions.ts's `ReviewerDetectionType`s) gets a
// stable issueCode, a category, and the composite ("dimension" in the
// analytics sense, NOT the 11-key DimensionKey) it affects.
//
// CODES ARE PERMANENT. Never rename or repurpose a key in ISSUE_TAXONOMY —
// every ResumeIssue row ever written references one by exact string, and
// trend data (Part B Prompt 6's weekly PopulationSnapshot) breaks the
// instant a code's meaning shifts under it. To retire a code: leave the key
// and its entry in place, set `deprecated: true`, and add it to
// DEPRECATED_ISSUE_CODES below with a comment saying what replaced it (if
// anything). Never delete a key.
//
// Deliberately dependency-free (no 'server-only', no Prisma, no imports
// from anywhere else in resume-analysis/) — same commitment
// resume-analysis/types.ts makes, since that file imports IssueCode from
// here for the Finding type and needs to stay importable from client
// components. The few string unions below that mirror types defined
// elsewhere (ReviewerDetectionType in resume-analysis/types.ts; the ATS
// flag / mechanics issue `kind` enums in extract-facts.ts) are intentionally
// re-declared locally rather than imported, to avoid a circular import
// (types.ts -> here -> types.ts) and to keep this module a leaf. Keep them
// in sync by hand if the source enums change — each mapping table below
// names its source of truth in a comment.

export type IssueCategory =
  | 'ats_parsing'
  | 'evidence_quality'
  | 'positioning'
  | 'mechanics'
  | 'contactability'
  | 'reconciliation'
  | 'reviewer_question'
  | 'structure'

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical'

// Analytics-facing composite, distinct from resume-analysis/types.ts's
// ExperienceResumeComponent ('EXPERIENCE' | 'RESUME') — same underlying
// split (Master Build Script §3.1), different casing/vocabulary because
// this one is spec'd (Part B Prompt 1) independently of the scoring engine.
// Rule used to assign this per code below: reviewer_question-category codes
// (gaps, tenure, scope, stagnation, title inflation, portfolio-career read)
// are about the career itself -> 'your_experience'. Every other category
// (ats_parsing, evidence_quality, positioning, mechanics, contactability,
// reconciliation, structure) is about the document or its internal
// consistency -> 'your_resume' — reconciliation in particular is explicit
// in modifiers.ts: "Prestige and reconciliation apply to Resume only."
export type IssueDimension = 'your_experience' | 'your_resume'

export type IssueFixableIn = 'seconds' | 'minutes' | 'hours' | 'not_fixable'

export interface IssueTaxonomyEntry {
  code: IssueCode
  category: IssueCategory
  severity: IssueSeverity
  dimension: IssueDimension
  // "Typical" — a planning-aid figure for the admin Point Impact view
  // (Part B Prompt 4), not a per-instance measurement. Where the engine
  // has a real estimatedPointGain/penalty for the matching push-site, this
  // mirrors it; where a code isn't triggered by the engine yet (see the
  // "not yet triggered" notes below), it's a reasonable placeholder.
  typicalPointImpact: number
  fixableIn: IssueFixableIn
  candidateFacingLabel: string
  // Set only when retiring a code — see the file-header comment.
  deprecated?: boolean
}

// ── IssueCode ────────────────────────────────────────────────────────────
// Every spec example code (Part B Prompt 1's table) plus 4 new codes added
// because a real engine detection had no good fit: meaningful_graphic,
// punctuation_inconsistency, stale_terminology, comp_scope_mismatch (see
// each one's comment below for why). A handful of spec example codes are
// defined here but not yet triggered by any push-site in dimensions.ts/
// modifiers.ts/reviewer-questions.ts today — kept anyway because Prompt 1
// asks for the taxonomy to cover the category table as given, and because a
// future scoring-engine change should be able to start using an existing
// code instead of minting a new one. Each is marked "not yet triggered"
// below.
export type IssueCode =
  // ats_parsing — mirrors extract-facts.ts's atsFlagSchema `kind` enum
  // (9 values) via ATS_FLAG_KIND_TO_ISSUE_CODE below, plus one spec example
  // (header_footer_content) the engine can't measure from text alone (see
  // ats-matrix.ts's iCIMS profile comment).
  | 'letter_spaced_headings'
  | 'content_in_table'
  | 'multi_column'
  | 'image_only_pdf'
  | 'header_footer_content' // not yet triggered — see ats-matrix.ts iCIMS comment
  | 'nonstandard_section_name'
  | 'inconsistent_date_format'
  | 'unembedded_font'
  | 'uninformative_filename'
  | 'meaningful_graphic' // NEW — extract-facts.ts's MEANINGFUL_GRAPHIC ats flag has no spec example code

  // evidence_quality
  | 'no_metrics'
  | 'metric_without_baseline'
  | 'activity_not_outcome'
  | 'low_quantification_density'
  | 'weak_verbs' // detected via mechanicsIssueSchema's WEAK_VERB kind, but categorized here per the spec table, not under mechanics

  // positioning
  | 'no_target_line'
  | 'objective_statement' // not yet triggered — no push-site produces this today
  | 'no_summary'
  | 'backward_looking_summary' // not yet triggered — folded into the same push-site as no_summary today (see dimensions.ts scoreNarrativePositioning)
  | 'incoherent_trajectory' // not yet triggered — scoreTrajectory() never pushes a Finding (apparent decreases surface as SCOPE_DECREASE reviewer questions instead)

  // mechanics — mirrors extract-facts.ts's mechanicsIssueSchema `kind` enum
  // (9 values) via MECHANICS_ISSUE_KIND_TO_ISSUE_CODE below, minus WEAK_VERB
  // (see evidence_quality above) and ORPHANED_SECTION (see structure below).
  | 'typo'
  | 'tense_inconsistency'
  | 'punctuation_inconsistency' // NEW — extract-facts.ts's PUNCTUATION_INCONSISTENCY mechanics-issue kind has no spec example code
  | 'bullet_too_long'
  | 'bullet_fragment'
  | 'page_count_mismatch' // not yet triggered — no push-site produces this today
  | 'postnominal_credential'
  | 'references_available_line' // not yet triggered — no push-site produces this today
  | 'us_convention_violation'
  | 'stale_terminology' // NEW — dimensions.ts scoreSkillCurrency's dated-vocabulary finding has no spec example code

  // contactability
  | 'missing_phone' // not yet triggered as a Finding — scoreContactability folds it into the score only, no push-site
  | 'missing_linkedin'
  | 'name_email_mismatch'
  | 'missing_location' // not yet triggered as a Finding — same as missing_phone

  // reconciliation
  | 'years_experience_mismatch'
  | 'overlapping_full_time'
  | 'credential_without_institution'
  | 'scope_contradiction' // not yet triggered — no current push-site maps cleanly; kept for a future, more specific reconciliation check
  | 'tenure_date_mismatch'
  | 'comp_scope_mismatch' // NEW — reviewer-questions.ts's COMP_FIT_RISK detection doesn't fit any spec example reconciliation code (see REVIEWER_DETECTION_TYPE_TO_ISSUE_CODE)

  // reviewer_question — 1:1 with reviewer-questions.ts's 9 non-reconciliation
  // ReviewerDetectionType values (see REVIEWER_DETECTION_TYPE_TO_ISSUE_CODE).
  | 'unexplained_gap'
  | 'current_gap'
  | 'short_tenure_recent'
  | 'short_tenure_cluster'
  | 'scope_decrease'
  | 'thin_recent_entry'
  | 'stagnation'
  | 'title_inflation'
  | 'portfolio_career_read'

  // structure
  | 'buried_lede' // not yet triggered — no push-site produces this today
  | 'weak_ordering' // not yet triggered — no push-site produces this today
  | 'orphaned_section' // detected via mechanicsIssueSchema's ORPHANED_SECTION kind, but categorized here per the spec table, not under mechanics

// ── Registry ─────────────────────────────────────────────────────────────
export const ISSUE_TAXONOMY: Record<IssueCode, IssueTaxonomyEntry> = {
  // ats_parsing — hard failures (image_only_pdf, content_in_table,
  // multi_column — see extract-facts.ts's prompt: these three cap the
  // atsLegibility dimension at 25) are critical/hours-to-fix (structural
  // rebuild); everything else here is a soft/graduated flag.
  letter_spaced_headings: {
    code: 'letter_spaced_headings', category: 'ats_parsing', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 4, fixableIn: 'minutes', candidateFacingLabel: 'Letter-spaced section headings',
  },
  content_in_table: {
    code: 'content_in_table', category: 'ats_parsing', severity: 'critical', dimension: 'your_resume',
    typicalPointImpact: 20, fixableIn: 'hours', candidateFacingLabel: 'Content inside a table or text box',
  },
  multi_column: {
    code: 'multi_column', category: 'ats_parsing', severity: 'critical', dimension: 'your_resume',
    typicalPointImpact: 20, fixableIn: 'hours', candidateFacingLabel: 'Multi-column layout in your experience section',
  },
  image_only_pdf: {
    code: 'image_only_pdf', category: 'ats_parsing', severity: 'critical', dimension: 'your_resume',
    typicalPointImpact: 20, fixableIn: 'hours', candidateFacingLabel: 'Image-only PDF (no extractable text)',
  },
  header_footer_content: {
    code: 'header_footer_content', category: 'ats_parsing', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 4, fixableIn: 'minutes', candidateFacingLabel: 'Contact info placed in a header or footer',
  },
  nonstandard_section_name: {
    code: 'nonstandard_section_name', category: 'ats_parsing', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 4, fixableIn: 'minutes', candidateFacingLabel: 'Non-standard section name',
  },
  inconsistent_date_format: {
    code: 'inconsistent_date_format', category: 'ats_parsing', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 4, fixableIn: 'minutes', candidateFacingLabel: 'Inconsistent date formatting',
  },
  unembedded_font: {
    code: 'unembedded_font', category: 'ats_parsing', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 4, fixableIn: 'minutes', candidateFacingLabel: 'Non-standard or unembedded font',
  },
  uninformative_filename: {
    code: 'uninformative_filename', category: 'ats_parsing', severity: 'low', dimension: 'your_resume',
    typicalPointImpact: 4, fixableIn: 'seconds', candidateFacingLabel: 'Uninformative file name',
  },
  meaningful_graphic: {
    code: 'meaningful_graphic', category: 'ats_parsing', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 4, fixableIn: 'hours', candidateFacingLabel: 'Meaningful content conveyed only in a graphic',
  },

  // evidence_quality
  no_metrics: {
    code: 'no_metrics', category: 'evidence_quality', severity: 'high', dimension: 'your_resume',
    typicalPointImpact: 8, fixableIn: 'hours', candidateFacingLabel: 'No scope numbers on any role',
  },
  metric_without_baseline: {
    code: 'metric_without_baseline', category: 'evidence_quality', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 5, fixableIn: 'minutes', candidateFacingLabel: 'Numbers without a from/to baseline',
  },
  activity_not_outcome: {
    code: 'activity_not_outcome', category: 'evidence_quality', severity: 'high', dimension: 'your_resume',
    typicalPointImpact: 8, fixableIn: 'minutes', candidateFacingLabel: 'Bullet describes a duty, not a result',
  },
  low_quantification_density: {
    code: 'low_quantification_density', category: 'evidence_quality', severity: 'high', dimension: 'your_resume',
    typicalPointImpact: 10, fixableIn: 'hours', candidateFacingLabel: 'Fewer than a third of bullets carry a number',
  },
  weak_verbs: {
    code: 'weak_verbs', category: 'evidence_quality', severity: 'low', dimension: 'your_resume',
    typicalPointImpact: 1, fixableIn: 'minutes', candidateFacingLabel: 'Weak opening verb',
  },

  // positioning
  no_target_line: {
    code: 'no_target_line', category: 'positioning', severity: 'high', dimension: 'your_resume',
    typicalPointImpact: 12, fixableIn: 'minutes', candidateFacingLabel: 'No stated target role',
  },
  objective_statement: {
    code: 'objective_statement', category: 'positioning', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 4, fixableIn: 'minutes', candidateFacingLabel: 'Dated "objective statement" framing',
  },
  no_summary: {
    code: 'no_summary', category: 'positioning', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 6, fixableIn: 'minutes', candidateFacingLabel: 'No summary stating the target plainly',
  },
  backward_looking_summary: {
    code: 'backward_looking_summary', category: 'positioning', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 5, fixableIn: 'minutes', candidateFacingLabel: 'Summary describes the past, not the target',
  },
  incoherent_trajectory: {
    code: 'incoherent_trajectory', category: 'positioning', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 6, fixableIn: 'hours', candidateFacingLabel: 'Career narrative reads as incoherent',
  },

  // mechanics
  typo: {
    code: 'typo', category: 'mechanics', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 3, fixableIn: 'seconds', candidateFacingLabel: 'Typo',
  },
  tense_inconsistency: {
    code: 'tense_inconsistency', category: 'mechanics', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 1, fixableIn: 'seconds', candidateFacingLabel: 'Inconsistent verb tense',
  },
  punctuation_inconsistency: {
    code: 'punctuation_inconsistency', category: 'mechanics', severity: 'low', dimension: 'your_resume',
    typicalPointImpact: 1, fixableIn: 'seconds', candidateFacingLabel: 'Inconsistent punctuation',
  },
  bullet_too_long: {
    code: 'bullet_too_long', category: 'mechanics', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 1, fixableIn: 'minutes', candidateFacingLabel: 'Wall-of-text bullet',
  },
  bullet_fragment: {
    code: 'bullet_fragment', category: 'mechanics', severity: 'low', dimension: 'your_resume',
    typicalPointImpact: 1, fixableIn: 'minutes', candidateFacingLabel: 'One-word or fragment bullet',
  },
  page_count_mismatch: {
    code: 'page_count_mismatch', category: 'mechanics', severity: 'low', dimension: 'your_resume',
    typicalPointImpact: 3, fixableIn: 'hours', candidateFacingLabel: 'Page count doesn’t match seniority norms',
  },
  postnominal_credential: {
    code: 'postnominal_credential', category: 'mechanics', severity: 'low', dimension: 'your_resume',
    typicalPointImpact: 1, fixableIn: 'seconds', candidateFacingLabel: 'Non-licensure postnominal after your name',
  },
  references_available_line: {
    code: 'references_available_line', category: 'mechanics', severity: 'low', dimension: 'your_resume',
    typicalPointImpact: 1, fixableIn: 'seconds', candidateFacingLabel: '"References available upon request" line',
  },
  us_convention_violation: {
    code: 'us_convention_violation', category: 'mechanics', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 1, fixableIn: 'minutes', candidateFacingLabel: 'Non-US resume convention',
  },
  stale_terminology: {
    code: 'stale_terminology', category: 'mechanics', severity: 'low', dimension: 'your_resume',
    typicalPointImpact: 2, fixableIn: 'minutes', candidateFacingLabel: 'Dated terminology for your function',
  },

  // contactability
  missing_phone: {
    code: 'missing_phone', category: 'contactability', severity: 'low', dimension: 'your_resume',
    typicalPointImpact: 1, fixableIn: 'seconds', candidateFacingLabel: 'No phone number',
  },
  missing_linkedin: {
    code: 'missing_linkedin', category: 'contactability', severity: 'low', dimension: 'your_resume',
    typicalPointImpact: 1, fixableIn: 'seconds', candidateFacingLabel: 'No LinkedIn URL',
  },
  name_email_mismatch: {
    code: 'name_email_mismatch', category: 'contactability', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 0, fixableIn: 'seconds', candidateFacingLabel: 'Email doesn’t match your name',
  },
  missing_location: {
    code: 'missing_location', category: 'contactability', severity: 'low', dimension: 'your_resume',
    typicalPointImpact: 1, fixableIn: 'seconds', candidateFacingLabel: 'No location listed',
  },

  // reconciliation — applies to Resume only (modifiers.ts: "Prestige and
  // reconciliation apply to Resume only").
  years_experience_mismatch: {
    code: 'years_experience_mismatch', category: 'reconciliation', severity: 'high', dimension: 'your_resume',
    typicalPointImpact: 3, fixableIn: 'minutes', candidateFacingLabel: 'Stated years of experience don’t match your dates',
  },
  overlapping_full_time: {
    code: 'overlapping_full_time', category: 'reconciliation', severity: 'high', dimension: 'your_resume',
    typicalPointImpact: 3, fixableIn: 'minutes', candidateFacingLabel: 'Two full-time roles overlap in time',
  },
  credential_without_institution: {
    code: 'credential_without_institution', category: 'reconciliation', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 2, fixableIn: 'minutes', candidateFacingLabel: 'Credential listed without a granting institution',
  },
  scope_contradiction: {
    code: 'scope_contradiction', category: 'reconciliation', severity: 'high', dimension: 'your_resume',
    typicalPointImpact: 2, fixableIn: 'minutes', candidateFacingLabel: 'Stated scope contradicts itself',
  },
  tenure_date_mismatch: {
    code: 'tenure_date_mismatch', category: 'reconciliation', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 2, fixableIn: 'minutes', candidateFacingLabel: 'A claim doesn’t line up with your role timeline',
  },
  comp_scope_mismatch: {
    code: 'comp_scope_mismatch', category: 'reconciliation', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 3, fixableIn: 'not_fixable', candidateFacingLabel: 'Recent scope well above typical pay for the target level',
  },

  // reviewer_question — about the career itself, not the document; no
  // literal "fix," only an explanation or a source-data correction (the
  // walkthrough's 3-way CORRECTED/NOT_APPLICABLE/LEAVE_AS_IS resolution).
  unexplained_gap: {
    code: 'unexplained_gap', category: 'reviewer_question', severity: 'high', dimension: 'your_experience',
    typicalPointImpact: 4, fixableIn: 'minutes', candidateFacingLabel: 'Unexplained gap between roles',
  },
  current_gap: {
    code: 'current_gap', category: 'reviewer_question', severity: 'high', dimension: 'your_experience',
    typicalPointImpact: 6, fixableIn: 'minutes', candidateFacingLabel: 'Current gap since your last role',
  },
  short_tenure_recent: {
    code: 'short_tenure_recent', category: 'reviewer_question', severity: 'medium', dimension: 'your_experience',
    typicalPointImpact: 4, fixableIn: 'minutes', candidateFacingLabel: 'Short tenure in your most recent role',
  },
  short_tenure_cluster: {
    code: 'short_tenure_cluster', category: 'reviewer_question', severity: 'medium', dimension: 'your_experience',
    typicalPointImpact: 6, fixableIn: 'minutes', candidateFacingLabel: 'Recent cluster of short-tenure roles',
  },
  scope_decrease: {
    code: 'scope_decrease', category: 'reviewer_question', severity: 'medium', dimension: 'your_experience',
    typicalPointImpact: 5, fixableIn: 'minutes', candidateFacingLabel: 'Apparent scope decrease between roles',
  },
  thin_recent_entry: {
    code: 'thin_recent_entry', category: 'reviewer_question', severity: 'medium', dimension: 'your_experience',
    typicalPointImpact: 4, fixableIn: 'minutes', candidateFacingLabel: 'Most recent role is thin on detail',
  },
  stagnation: {
    code: 'stagnation', category: 'reviewer_question', severity: 'low', dimension: 'your_experience',
    typicalPointImpact: 3, fixableIn: 'minutes', candidateFacingLabel: 'Extended tenure with no title change',
  },
  title_inflation: {
    code: 'title_inflation', category: 'reviewer_question', severity: 'medium', dimension: 'your_experience',
    typicalPointImpact: 4, fixableIn: 'minutes', candidateFacingLabel: 'Title outranks the stated scope',
  },
  portfolio_career_read: {
    code: 'portfolio_career_read', category: 'reviewer_question', severity: 'low', dimension: 'your_experience',
    typicalPointImpact: 3, fixableIn: 'minutes', candidateFacingLabel: 'Reads as a portfolio-style career',
  },

  // structure
  buried_lede: {
    code: 'buried_lede', category: 'structure', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 5, fixableIn: 'hours', candidateFacingLabel: 'Best evidence is buried, not led with',
  },
  weak_ordering: {
    code: 'weak_ordering', category: 'structure', severity: 'medium', dimension: 'your_resume',
    typicalPointImpact: 4, fixableIn: 'minutes', candidateFacingLabel: 'Section order works against you',
  },
  orphaned_section: {
    code: 'orphaned_section', category: 'structure', severity: 'low', dimension: 'your_resume',
    typicalPointImpact: 1, fixableIn: 'minutes', candidateFacingLabel: 'Section with no real content',
  },
}

// Retired codes — see the file-header comment. Empty today; add entries
// here (and set `deprecated: true` on the matching ISSUE_TAXONOMY entry,
// never delete it) the day a code is actually retired.
export const DEPRECATED_ISSUE_CODES: IssueCode[] = []

// ── Engine -> taxonomy mapping tables ───────────────────────────────────

// Mirrors extract-facts.ts's atsFlagSchema `kind` enum exactly (9 values) —
// keep in sync by hand if that schema changes.
export type AtsFlagKind =
  | 'IMAGE_ONLY_PDF'
  | 'TABLE_OR_TEXTBOX_CONTENT'
  | 'MULTI_COLUMN_EXPERIENCE'
  | 'LETTER_SPACED_HEADING'
  | 'NON_STANDARD_FONT'
  | 'MEANINGFUL_GRAPHIC'
  | 'INCONSISTENT_DATE_FORMAT'
  | 'NON_STANDARD_SECTION_NAME'
  | 'UNINFORMATIVE_FILENAME'

export const ATS_FLAG_KIND_TO_ISSUE_CODE: Record<AtsFlagKind, IssueCode> = {
  IMAGE_ONLY_PDF: 'image_only_pdf',
  TABLE_OR_TEXTBOX_CONTENT: 'content_in_table',
  MULTI_COLUMN_EXPERIENCE: 'multi_column',
  LETTER_SPACED_HEADING: 'letter_spaced_headings',
  NON_STANDARD_FONT: 'unembedded_font',
  MEANINGFUL_GRAPHIC: 'meaningful_graphic',
  INCONSISTENT_DATE_FORMAT: 'inconsistent_date_format',
  NON_STANDARD_SECTION_NAME: 'nonstandard_section_name',
  UNINFORMATIVE_FILENAME: 'uninformative_filename',
}

// Mirrors extract-facts.ts's mechanicsIssueSchema `kind` enum exactly
// (9 values) — keep in sync by hand if that schema changes.
export type MechanicsIssueKind =
  | 'TYPO'
  | 'TENSE_INCONSISTENCY'
  | 'PUNCTUATION_INCONSISTENCY'
  | 'WALL_OF_TEXT_BULLET'
  | 'ONE_WORD_FRAGMENT'
  | 'WEAK_VERB'
  | 'ORPHANED_SECTION'
  | 'POSTNOMINAL_NON_LICENSURE'
  | 'US_CONVENTION_VIOLATION'

export const MECHANICS_ISSUE_KIND_TO_ISSUE_CODE: Record<MechanicsIssueKind, IssueCode> = {
  TYPO: 'typo',
  TENSE_INCONSISTENCY: 'tense_inconsistency',
  PUNCTUATION_INCONSISTENCY: 'punctuation_inconsistency',
  WALL_OF_TEXT_BULLET: 'bullet_too_long',
  ONE_WORD_FRAGMENT: 'bullet_fragment',
  WEAK_VERB: 'weak_verbs',
  ORPHANED_SECTION: 'orphaned_section',
  POSTNOMINAL_NON_LICENSURE: 'postnominal_credential',
  US_CONVENTION_VIOLATION: 'us_convention_violation',
}

// Mirrors resume-analysis/types.ts's ReviewerDetectionType exactly
// (12 values) — re-declared locally rather than imported to avoid a
// circular import (types.ts imports IssueCode from this file). Keep in
// sync by hand if that union changes.
//
// 9 of the 12 map onto the reviewer_question category 1:1 with the spec's
// example codes. The other 3 — OVERLAPPING_ROLES, CREDENTIAL_NO_INSTITUTION,
// COMP_FIT_RISK — read as reconciliation issues (a contradiction between
// two stated facts, or a scope/comp mismatch) rather than "something a
// reviewer would ask about," so they map to reconciliation category codes
// instead: the first two reuse the same codes modifiers.ts's
// computeReconciliation() already produces for its own (structurally
// identical) checks, and COMP_FIT_RISK gets the new comp_scope_mismatch
// code since no reconciliation example code fits a comp/scope read.
export type ReviewerDetectionTypeForTaxonomy =
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

export const REVIEWER_DETECTION_TYPE_TO_ISSUE_CODE: Record<ReviewerDetectionTypeForTaxonomy, IssueCode> = {
  UNEXPLAINED_RECENT_GAP: 'unexplained_gap',
  UNEXPLAINED_CURRENT_GAP: 'current_gap',
  SHORT_TENURE_RECENT: 'short_tenure_recent',
  SHORT_TENURE_CLUSTER: 'short_tenure_cluster',
  SCOPE_DECREASE: 'scope_decrease',
  THIN_RECENT_ENTRY: 'thin_recent_entry',
  EXTENDED_TENURE_NO_CHANGE: 'stagnation',
  TITLE_INFLATION: 'title_inflation',
  OVERLAPPING_ROLES: 'overlapping_full_time',
  CREDENTIAL_NO_INSTITUTION: 'credential_without_institution',
  PORTFOLIO_CAREER: 'portfolio_career_read',
  COMP_FIT_RISK: 'comp_scope_mismatch',
}

// resume-analysis/types.ts's Finding.severity is 3-level (HIGH/MEDIUM/LOW);
// ResumeIssue.severity (and this taxonomy) is 4-level, matching Prompt 1's
// spec. 'critical' is never produced by this mapping — it's reserved for
// ats_parsing's three hard-failure codes, which carry a fixed 'critical'
// severity in ISSUE_TAXONOMY regardless of the originating Finding's
// severity (see dimensions.ts's scoreAtsLegibility, which always emits
// 'HIGH' for a hard failure — mapping that through would under-state it).
export function mapFindingSeverityToIssueSeverity(severity: 'HIGH' | 'MEDIUM' | 'LOW'): IssueSeverity {
  switch (severity) {
    case 'HIGH':
      return 'high'
    case 'MEDIUM':
      return 'medium'
    case 'LOW':
      return 'low'
  }
}
