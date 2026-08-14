// The single extraction pass for the Record component — reads the resume
// text once and returns structured facts. Deliberately does NOT ask the
// model for any of the 10 dimension 0-100 scores directly except the two
// genuinely qualitative reads with no deterministic proxy (narrative
// coherence, mechanics polish) — every other dimension is computed in pure
// TS (dimensions.ts) from the facts below, so the actual point math stays
// auditable and testable independent of model output, matching the
// hireability-grade.ts convention elsewhere in this codebase.
//
// Schema kept flat-ish and array-heavy on purpose — Anthropic's structured
// output has a cap on top-level nullable/union-typed parameters (confirmed
// via a real 400 in extract-profile-fields.ts); nesting variability inside
// array items avoids multiplying that count the way many top-level
// nullable scalars would.

import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'

const bulletSchema = z.object({
  text: z.string(),
  // "Grew revenue from $3.9B to $5.4B" — true. "Responsible for..." — false.
  isOutcomeNotActivity: z.boolean(),
  // Specifically a from/to pair (spec §4.1) — the strongest evidence form,
  // scored above a bare percentage or single number.
  hasBaselinePair: z.boolean(),
  hasAnyNumber: z.boolean(),
})

const roleSchema = z.object({
  title: z.string(),
  company: z.string(),
  startDate: z.string().nullable(), // ISO, YYYY-01-01 if only a year given
  endDate: z.string().nullable(), // null if isCurrent
  isCurrent: z.boolean(),
  isInternship: z.boolean(),
  // Scope numbers, spec §4.4 — extract only what's explicitly stated, never
  // inferred or estimated. Null where the resume doesn't say.
  budgetOrPnlUsd: z.number().nullable(),
  headcount: z.number().int().nullable(),
  quotaUsd: z.number().nullable(),
  quotaAttainmentPct: z.number().nullable(),
  geographyScope: z.string().nullable(), // "North America", "12 states", "global"
  reportingLine: z.string().nullable(), // "reports to CEO", "reports to VP Sales"
  bullets: z.array(bulletSchema).max(15),
})

const educationSchema = z.object({
  schoolName: z.string(), // parent institution only, normalized (spec §4 catalog convention already used elsewhere)
  degree: z.string().nullable(),
  fieldOfStudy: z.string().nullable(),
  graduationDate: z.string().nullable(),
  hasGrantingInstitution: z.boolean(), // false = "MBA" with no school named — feeds CREDENTIAL_NO_INSTITUTION
})

const extracurricularSchema = z.object({
  organization: z.string(),
  role: z.string(),
  kind: z.enum(['BOARD_SEAT', 'ASSOCIATION_LEADERSHIP', 'VOLUNTEER_LEADERSHIP', 'PUBLISHED_WORK', 'SPEAKING', 'TEACHING', 'GENERIC_VOLUNTEER']),
  isCurrent: z.boolean(),
})

const mechanicsIssueSchema = z.object({
  kind: z.enum([
    'TYPO',
    'TENSE_INCONSISTENCY',
    'PUNCTUATION_INCONSISTENCY',
    'WALL_OF_TEXT_BULLET',
    'ONE_WORD_FRAGMENT',
    'WEAK_VERB',
    'ORPHANED_SECTION',
    'POSTNOMINAL_NON_LICENSURE',
    'US_CONVENTION_VIOLATION',
  ]),
  quote: z.string(), // the offending text, verbatim, for self-check + candidate-facing before/after
  location: z.string(), // e.g. "most recent role, bullet 2" — for ordering by recency weight
})

const atsFlagSchema = z.object({
  kind: z.enum([
    'IMAGE_ONLY_PDF',
    'TABLE_OR_TEXTBOX_CONTENT',
    'MULTI_COLUMN_EXPERIENCE',
    'LETTER_SPACED_HEADING',
    'NON_STANDARD_FONT',
    'MEANINGFUL_GRAPHIC',
    'INCONSISTENT_DATE_FORMAT',
    'NON_STANDARD_SECTION_NAME',
    'UNINFORMATIVE_FILENAME',
  ]),
  detail: z.string(),
  isHardFailure: z.boolean(), // spec §4.3 — image-only/table/multi-column cap the dimension at 25
})

const ResumeAnalysisFactsSchema = z.object({
  roles: z.array(roleSchema).max(15),
  education: z.array(educationSchema).max(6),
  extracurricular: z.array(extracurricularSchema).max(8),
  mechanicsIssues: z.array(mechanicsIssueSchema).max(20),
  atsFlags: z.array(atsFlagSchema).max(15),

  // Contactability (spec §4.10)
  hasEmail: z.boolean(),
  hasPhone: z.boolean(),
  hasLinkedIn: z.boolean(),
  hasLocation: z.boolean(),
  candidateName: z.string().nullable(),
  emailNameMismatch: z.boolean(), // flagged as a question, never an error — see spec's false-positive caution

  // Narrative & Positioning (spec §4.2) — genuinely qualitative, no
  // deterministic proxy, scored directly here with justification.
  hasSummary: z.boolean(),
  summaryIsForwardLooking: z.boolean(),
  targetStatedOrInferable: z.boolean(),
  narrativePositioningScore: z.number().int().min(0).max(100),
  narrativePositioningRationale: z.string(),

  // Mechanics & Presentation overall polish (spec §4.8) — the issues list
  // above is the granular findings source; this is the holistic read
  // (verb quality trend, bullet-length distribution) that doesn't reduce
  // to a simple issue count.
  mechanicsPresentationScore: z.number().int().min(0).max(100),

  // Skill & Vocabulary Currency (spec §4.9)
  currentTerminologyFound: z.array(z.string()).max(15),
  staleTerminologyFound: z.array(z.string()).max(10),

  // First Glance signals (spec §3.5) — what's visible without reading
  topOfDocumentClear: z.boolean(), // name, current title, positioning line, target all in one glance
  mostRecentRoleLegibleAtGlance: z.boolean(), // title/company/dates/scope all visible without reconstruction
  trajectoryApparentAtGlance: z.boolean(),
  visualScanability: z.number().int().min(0).max(100), // whitespace, hierarchy, bullet density, page-one payload

  // Reconciliation inputs (spec §4.11) — raw claims to check against the
  // roles[] timeline computed in TS, never trusted directly.
  statedYearsExperience: z.number().nullable(), // what the summary claims, if any
  summaryClaimsOverlapWithTimeline: z.boolean(), // model's own sanity check while reading

  seniorityLevelStated: z.string().nullable(), // e.g. "VP", "Director" — as literally titled, for title-inflation comparison against scope
})

export type ResumeAnalysisFacts = z.infer<typeof ResumeAnalysisFactsSchema>

const PROMPT = `You are extracting structured facts from a resume for a scoring system that computes its own point math in code — your job is objective extraction and classification, not grading. Only extract what's explicitly present in the text; never fabricate or estimate a number that isn't stated. Use null/false where the resume doesn't say.

For each role's bullets: classify each one as outcome-vs-activity (does it state a result, not just a duty?), whether it's specifically a from/to baseline pair ("grew revenue from $3.9B to $5.4B" — the strongest form), and whether it has any number at all.

For scope numbers (budget, headcount, quota, geography, reporting line): extract ONLY what's explicitly stated per role. Do not infer scope from title alone — many companies use inflated titles, and the scoring system deliberately ignores title rank in favor of these numbers.

For mechanics issues: quote the offending text verbatim so it can be shown as a before/after. Flag postnominal credentials after the candidate's name as POSTNOMINAL_NON_LICENSURE only for non-licensure credentials (MBA, most certifications) — MD/PhD/JD/CPA/PE/CFA/RN and comparable licensure are a normal, acceptable convention and should NOT be flagged.

For ATS flags: IMAGE_ONLY_PDF, TABLE_OR_TEXTBOX_CONTENT, and MULTI_COLUMN_EXPERIENCE are hard failures (isHardFailure: true) — everything else is graduated (isHardFailure: false).

For narrativePositioningScore: does the document argue for a next role, or only record past ones? A resume with no summary, no stated target, and a sequence of roles that doesn't read as a coherent thesis scores low. A resume with a clear, forward-looking summary connecting the record to a stated target scores high.

For mechanicsPresentationScore: holistic care taken with the document — verb quality trend across bullets (led/owned/built/shipped vs. "responsible for"/"helped with"), bullet length distribution, overall polish. This is separate from the itemized mechanicsIssues list above.

For emailNameMismatch: flag it as a question only — shared household inboxes, maiden/married names, anglicized first names, and nicknames all produce legitimate mismatches, so only flag when there's no plausible innocent explanation visible in the text.

Resume text:
`

export async function extractResumeAnalysisFacts(resumeText: string): Promise<ResumeAnalysisFacts | null> {
  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    output_config: { format: zodOutputFormat(ResumeAnalysisFactsSchema), effort: 'medium' },
    messages: [{ role: 'user', content: `${PROMPT}${resumeText}` }],
  })
  const message = await stream.finalMessage()
  return message.parsed_output ?? null
}
