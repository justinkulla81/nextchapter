// Extraction pass for the Record component — reads the resume text and
// returns structured facts. Deliberately does NOT ask the model for any of
// the 10 dimension 0-100 scores directly except the two genuinely
// qualitative reads with no deterministic proxy (narrative coherence,
// mechanics polish) — every other dimension is computed in pure TS
// (dimensions.ts) from the facts below, so the actual point math stays
// auditable and testable independent of model output, matching the
// dossier-competencies.ts convention elsewhere in this codebase.
//
// Schema kept flat-ish and array-heavy on purpose — Anthropic's structured
// output has a cap on top-level nullable/union-typed parameters (confirmed
// via a real 400 in extract-profile-fields.ts); nesting variability inside
// array items avoids multiplying that count the way many top-level
// nullable scalars would.
//
// Split into TWO parallel calls (structural facts vs. qualitative/mechanics
// facts) rather than one — confirmed via a real 400 ("The compiled grammar
// is too large... reduce the number of strict tools") against the original
// single-schema version even after cutting every array .max() bound hard.
// The single-schema version was never salvageable by trimming alone; the
// fix that actually worked, verified against a real resume, was splitting
// the schema. Same "split into sequential/parallel calls" fix already used
// elsewhere in this codebase for an oversized single call (Draft Core
// Narrative). The two calls read the same resumeText and have no
// dependency on each other, so they run concurrently via Promise.all —
// no added latency over the single-call version, just two smaller grammars.

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
  // Industry the EMPLOYER operates in, normalized to a short common noun
  // ("software", "healthcare", "financial services") — not the candidate's
  // function. Feeds industryCoherence (Your Experience component, Master
  // Build Script §3.1): how tightly a career clusters around related
  // industries. Null where the resume gives no basis to infer it.
  industry: z.string().nullable(),
  bullets: z.array(bulletSchema).max(6),
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

const StructuralFactsSchema = z.object({
  roles: z.array(roleSchema).max(10),
  education: z.array(educationSchema).max(4),
  extracurricular: z.array(extracurricularSchema).max(4),

  // Contactability (spec §4.10)
  hasEmail: z.boolean(),
  hasPhone: z.boolean(),
  hasLinkedIn: z.boolean(),
  hasLocation: z.boolean(),
  candidateName: z.string().nullable(),
  emailNameMismatch: z.boolean(), // flagged as a question, never an error — see spec's false-positive caution

  // Reconciliation inputs (spec §4.11) — raw claims to check against the
  // roles[] timeline computed in TS, never trusted directly.
  statedYearsExperience: z.number().nullable(), // what the summary claims, if any
  summaryClaimsOverlapWithTimeline: z.boolean(), // model's own sanity check while reading

  seniorityLevelStated: z.string().nullable(), // e.g. "VP", "Director" — as literally titled, for title-inflation comparison against scope
})

const STRUCTURAL_PROMPT = `You are extracting structured facts from a resume for a scoring system that computes its own point math in code — your job is objective extraction and classification, not grading. Only extract what's explicitly present in the text; never fabricate or estimate a number that isn't stated. Use null/false where the resume doesn't say.

For each role's bullets: classify each one as outcome-vs-activity (does it state a result, not just a duty?), whether it's specifically a from/to baseline pair ("grew revenue from $3.9B to $5.4B" — the strongest form), and whether it has any number at all.

For scope numbers (budget, headcount, quota, geography, reporting line): extract ONLY what's explicitly stated per role. Do not infer scope from title alone — many companies use inflated titles, and the scoring system deliberately ignores title rank in favor of these numbers.

For industry: name the employer's industry as a short common noun ("software", "healthcare", "financial services", "retail") based on the company name and any context given. Null only if there's genuinely no basis to guess (an unfamiliar company name with no other context).

For emailNameMismatch: flag it as a question only — shared household inboxes, maiden/married names, anglicized first names, and nicknames all produce legitimate mismatches, so only flag when there's no plausible innocent explanation visible in the text.

Resume text:
`

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

const QualitativeFactsSchema = z.object({
  mechanicsIssues: z.array(mechanicsIssueSchema).max(8),
  atsFlags: z.array(atsFlagSchema).max(9),

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
  currentTerminologyFound: z.array(z.string()).max(8),
  staleTerminologyFound: z.array(z.string()).max(6),

  // First Glance signals (spec §3.5) — what's visible without reading
  topOfDocumentClear: z.boolean(), // name, current title, positioning line, target all in one glance
  mostRecentRoleLegibleAtGlance: z.boolean(), // title/company/dates/scope all visible without reconstruction
  trajectoryApparentAtGlance: z.boolean(),
  visualScanability: z.number().int().min(0).max(100), // whitespace, hierarchy, bullet density, page-one payload
})

const QUALITATIVE_PROMPT = `You are extracting structured facts from a resume for a scoring system that computes its own point math in code — your job is objective extraction and classification, not grading. Only extract what's explicitly present in the text; never fabricate.

For mechanics issues: quote the offending text verbatim so it can be shown as a before/after. Flag postnominal credentials after the candidate's name as POSTNOMINAL_NON_LICENSURE only for non-licensure credentials (MBA, most certifications) — MD/PhD/JD/CPA/PE/CFA/RN and comparable licensure are a normal, acceptable convention and should NOT be flagged.

For ATS flags: IMAGE_ONLY_PDF, TABLE_OR_TEXTBOX_CONTENT, and MULTI_COLUMN_EXPERIENCE are hard failures (isHardFailure: true) — everything else is graduated (isHardFailure: false).

For narrativePositioningScore: does the document argue for a next role, or only record past ones? A resume with no summary, no stated target, and a sequence of roles that doesn't read as a coherent thesis scores low. A resume with a clear, forward-looking summary connecting the record to a stated target scores high.

For mechanicsPresentationScore: holistic care taken with the document — verb quality trend across bullets (led/owned/built/shipped vs. "responsible for"/"helped with"), bullet length distribution, overall polish. This is separate from the itemized mechanicsIssues list above.

Resume text:
`

export type ResumeAnalysisFacts = z.infer<typeof StructuralFactsSchema> & z.infer<typeof QualitativeFactsSchema>

async function extractStructuralFacts(resumeText: string) {
  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-sonnet-5',
    // Adaptive thinking draws from this same budget before the structured
    // output is emitted — a detailed resume can burn most of 6000 tokens on
    // thinking alone and leave the JSON output truncated mid-string
    // (confirmed in production: "Unterminated string in JSON" from
    // parsed_output failing on a real candidate's resume). Raised with
    // headroom rather than tuned to the exact failure case.
    max_tokens: 10000,
    thinking: { type: 'adaptive' },
    output_config: { format: zodOutputFormat(StructuralFactsSchema), effort: 'medium' },
    messages: [{ role: 'user', content: `${STRUCTURAL_PROMPT}${resumeText}` }],
  })
  const message = await stream.finalMessage()
  return message.parsed_output ?? null
}

async function extractQualitativeFacts(resumeText: string) {
  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-sonnet-5',
    // See extractStructuralFacts above — same adaptive-thinking-eats-the-
    // budget failure mode, raised with the same headroom.
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    output_config: { format: zodOutputFormat(QualitativeFactsSchema), effort: 'medium' },
    messages: [{ role: 'user', content: `${QUALITATIVE_PROMPT}${resumeText}` }],
  })
  const message = await stream.finalMessage()
  return message.parsed_output ?? null
}

export async function extractResumeAnalysisFacts(resumeText: string): Promise<ResumeAnalysisFacts | null> {
  const [structural, qualitative] = await Promise.all([extractStructuralFacts(resumeText), extractQualitativeFacts(resumeText)])
  if (!structural || !qualitative) return null
  return { ...structural, ...qualitative }
}
