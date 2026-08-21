import type { CrucibleMechanism } from './scoring-types'

export type CrucibleVariantKey = 'CODE' | 'MARKETING' | 'DATA'
export type CrucibleJobIntentKey = 'TECH' | 'MARKETING' | 'DATA' | 'DESIGN' | 'BUSINESS' | 'UNSURE'

// Job-intent fork routing — §10: "Design/Business/Unsure route onto an
// existing variant... no wrong door." The raw pick is stored separately
// (CrucibleSession.jobIntent) from the routed variant for the intent x
// score x degree-field research query.
export const JOB_INTENT_TO_VARIANT: Record<CrucibleJobIntentKey, CrucibleVariantKey> = {
  TECH: 'CODE',
  MARKETING: 'MARKETING',
  DATA: 'DATA',
  DESIGN: 'MARKETING',
  BUSINESS: 'DATA',
  UNSURE: 'CODE',
}

export interface CrucibleArtifactLine {
  line: number
  text: string
}

// One fixed checklist per variant replaces the original click-a-line,
// pick-a-mechanism, write-a-note interaction — that free-form flow tested
// unclear (no visible cue for what counted as "flaggable"). Exactly one
// option per variant is the real defect and exactly one is the herring;
// the rest are plausible-sounding distractors. isDefect/isHerring are
// never shown to the candidate — only `id`/`label` render in the UI.
export interface CrucibleChecklistOption {
  id: string
  label: string
  isDefect: boolean
  isHerring: boolean
  mechanism: CrucibleMechanism
}

export interface CrucibleVariantContent {
  key: CrucibleVariantKey
  label: string
  scenarioTitle: string
  brief: string
  artifactLabel: string
  lines: CrucibleArtifactLine[]
  checklistPrompt: string
  checklistOptions: CrucibleChecklistOption[]
  fixExplanation: string
  herringExplanation: string
}

// ── Variant 1 — CODE: "DoorList, ticketing app. An AI agent opened a PR:
// 'Add promo code support to checkout.'" — see build spec §4. Defect: the
// incremented promo.uses is never persisted (no db.promos.save), so a
// maxUses code is infinitely reusable. Red herring: leftover console.log.
const CODE_LINES: CrucibleArtifactLine[] = [
  { line: 1, text: '// applyPromo: validates and applies a promo code to an order' },
  { line: 2, text: 'export async function applyPromo(orderId: string, code: string) {' },
  { line: 3, text: '  const order = await db.orders.get(orderId);' },
  { line: 4, text: '  if (!order || order.status !== "pending") {' },
  { line: 5, text: '    return { ok: false, reason: "order_not_open" };' },
  { line: 6, text: '  }' },
  { line: 7, text: '  const promo = await db.promos.findByCode(code.trim().toUpperCase());' },
  { line: 8, text: '  console.log("applying promo:", code);' },
  { line: 9, text: '  if (!promo || !promo.active) {' },
  { line: 10, text: '    return { ok: false, reason: "invalid_code" };' },
  { line: 11, text: '  }' },
  { line: 12, text: '  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {' },
  { line: 13, text: '    return { ok: false, reason: "expired" };' },
  { line: 14, text: '  }' },
  { line: 15, text: '  if (promo.maxUses && promo.uses >= promo.maxUses) {' },
  { line: 16, text: '    return { ok: false, reason: "fully_redeemed" };' },
  { line: 17, text: '  }' },
  { line: 18, text: '  const discount = promo.type === "percent"' },
  { line: 19, text: '    ? Math.round(order.subtotal * (promo.value / 100))' },
  { line: 20, text: '    : Math.min(promo.value, order.subtotal);' },
  { line: 21, text: '  promo.uses = (promo.uses || 0) + 1;' },
  { line: 22, text: '  // NOTE: promo usage tracked for limited-run codes' },
  { line: 23, text: '  order.discount = discount;' },
  { line: 24, text: '  order.total = order.subtotal - discount;' },
  { line: 25, text: '  await db.orders.save(order);' },
  { line: 26, text: '  return { ok: true, discount, total: order.total };' },
  { line: 27, text: '}' },
]

// ── Variant 2 — MARKETING: "MIDNIGHT DROP" launch email to 40,214
// recipients. Defect: a fabricated "#1 ticketing app" TechCrunch
// endorsement — DoorList has never been reviewed by TechCrunch. Red
// herring: the emoji in the subject line (a taste call, not a block reason).
const MARKETING_LINES: CrucibleArtifactLine[] = [
  { line: 1, text: 'Subject: 🎉 MIDNIGHT DROP — Tickets Are Live on DoorList' },
  { line: 2, text: '' },
  { line: 3, text: 'Hey [First Name],' },
  { line: 4, text: '' },
  { line: 5, text: "It's happening. Tonight at midnight, the tickets you've been refreshing for go live on DoorList." },
  { line: 6, text: '' },
  { line: 7, text: "Here's why you should be first in line:" },
  { line: 8, text: '' },
  { line: 9, text: '- Instant checkout, zero fees on your first purchase' },
  { line: 10, text: '- Real-time availability — no more phantom "sold out" pages' },
  { line: 11, text: '- Rated the #1 ticketing app by TechCrunch' },
  { line: 12, text: '- Trusted by fans in over 40 cities' },
  { line: 13, text: '' },
  { line: 14, text: "We built DoorList because buying tickets shouldn't feel like a fight. Tonight, see for yourself." },
  { line: 15, text: '' },
  { line: 16, text: "Set your alarm. Midnight. Don't miss it." },
  { line: 17, text: '' },
  { line: 18, text: '— The DoorList Team' },
  { line: 19, text: '' },
  { line: 20, text: 'Sending to: 40,214 subscribers' },
]

// ── Variant 3 — DATA: an AI analyst memo to the CEO. Defect: the headline
// claims 40% revenue growth / a $4.2M projection, but the memo's own table
// shows $100,400 → $110,900 (~10.5%) — and it separately admits Solstice
// (the year's biggest event) launched the same month, an un-controlled-for
// confound. Red herring: "chart colors pending design review."
const DATA_LINES: CrucibleArtifactLine[] = [
  { line: 1, text: 'TO: CEO' },
  { line: 2, text: 'FROM: Growth Analytics (AI-generated draft)' },
  { line: 3, text: 'RE: Promo Code Program — Q3 Performance & Recommendation' },
  { line: 4, text: '' },
  { line: 5, text: 'Executive Summary' },
  { line: 6, text: '' },
  { line: 7, text: 'Promo codes drove a 40% increase in revenue this quarter. We recommend' },
  { line: 8, text: 'tripling the promo budget for Q4, projected to add $4.2M in incremental' },
  { line: 9, text: 'revenue.' },
  { line: 10, text: '' },
  { line: 11, text: 'Performance Data' },
  { line: 12, text: '' },
  { line: 13, text: 'Metric              Q2          Q3' },
  { line: 14, text: 'Revenue             $100,400    $110,900' },
  { line: 15, text: 'Promo redemptions   1,204       2,891' },
  { line: 16, text: 'Avg order value     $83         $89' },
  { line: 17, text: '' },
  { line: 18, text: 'Note: Solstice, our biggest event of the year, launched in the same' },
  { line: 19, text: "month as this quarter's promo expansion." },
  { line: 20, text: '' },
  { line: 21, text: 'Chart colors pending design review.' },
  { line: 22, text: '' },
  { line: 23, text: 'Recommendation' },
  { line: 24, text: '' },
  { line: 25, text: "Based on the strength of this quarter's results, we recommend tripling" },
  { line: 26, text: 'the Q4 promo budget immediately to capture similar gains.' },
]

export const CRUCIBLE_VARIANTS: Record<CrucibleVariantKey, CrucibleVariantContent> = {
  CODE: {
    key: 'CODE',
    label: 'Engineering',
    scenarioTitle: 'DoorList — Add promo code support to checkout',
    brief:
      'DoorList, a ticketing app. An AI agent opened a PR: "Add promo code support to checkout." The diff looks done. Visible tests pass — the happy path and the invalid-code path. It ships tonight unless you block it.',
    artifactLabel: 'The diff',
    lines: CODE_LINES,
    checklistPrompt: "What's wrong with this PR? Select everything you'd raise before it ships.",
    checklistOptions: [
      {
        id: 'code_never_saved',
        label: 'promo.uses is incremented in memory but never saved back to the database',
        isDefect: true,
        isHerring: false,
        mechanism: 'DATA_LOST_WRONG_NEVER_SAVED',
      },
      {
        id: 'code_console_log',
        label: "There's a leftover console.log statement",
        isDefect: false,
        isHerring: true,
        mechanism: 'STYLE_CLUTTER',
      },
      {
        id: 'code_rounding',
        label: 'The discount math rounds incorrectly for percent-off codes',
        isDefect: false,
        isHerring: false,
        mechanism: 'LOGIC_EDGE_CASE_ERROR',
      },
      {
        id: 'code_expiry_check',
        label: "Expired promo codes aren't checked before being applied",
        isDefect: false,
        isHerring: false,
        mechanism: 'LOGIC_EDGE_CASE_ERROR',
      },
      {
        id: 'code_injection',
        label: 'The promo code is applied with no input sanitization, risking injection',
        isDefect: false,
        isHerring: false,
        mechanism: 'SECURITY_PRIVACY_RISK',
      },
      {
        id: 'code_nothing_wrong',
        label: 'Nothing here needs to change — this is safe to ship as-is',
        isDefect: false,
        isHerring: false,
        mechanism: 'LOGIC_EDGE_CASE_ERROR',
      },
    ],
    fixExplanation:
      'promo.uses is incremented on the object fetched from the database — but never saved back. There\'s no db.promos.save(promo) anywhere in this function. A "first 100 customers" code, or any maxUses code, is infinitely reusable: the check reads a count that never actually moves. The fix is one line inside the same write: await db.promos.save(promo), alongside the existing await db.orders.save(order).',
    herringExplanation:
      "The console.log is real sloppiness — it shouldn't ship — but it costs nothing in production and reveals nothing sensitive. Blocking a release over a stray log line while the revenue bug ships anyway is the calibration failure being measured here.",
  },
  MARKETING: {
    key: 'MARKETING',
    label: 'Marketing',
    scenarioTitle: 'DoorList — MIDNIGHT DROP launch email',
    brief:
      'DoorList is launching a ticket drop tonight. An AI agent drafted the announcement email — 40,214 subscribers, sending in an hour. It reads clean and on-brand. It ships unless you block it.',
    artifactLabel: 'The email draft',
    lines: MARKETING_LINES,
    checklistPrompt: "What's wrong with this email? Select everything you'd raise before it sends.",
    checklistOptions: [
      {
        id: 'mktg_fabricated_claim',
        label: 'The email claims DoorList was rated #1 by TechCrunch — that claim is fabricated',
        isDefect: true,
        isHerring: false,
        mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
      },
      {
        id: 'mktg_emoji',
        label: 'The 🎉 emoji in the subject line feels unprofessional',
        isDefect: false,
        isHerring: true,
        mechanism: 'STYLE_CLUTTER',
      },
      {
        id: 'mktg_personalization',
        label: "The [First Name] merge field isn't personalized",
        isDefect: false,
        isHerring: false,
        mechanism: 'LOGIC_EDGE_CASE_ERROR',
      },
      {
        id: 'mktg_segmentation',
        label: 'Sending to all 40,214 subscribers without segmentation will hurt deliverability',
        isDefect: false,
        isHerring: false,
        mechanism: 'LOGIC_EDGE_CASE_ERROR',
      },
      {
        id: 'mktg_fee_terms',
        label: "\"Zero fees on your first purchase\" is promised with no terms or expiration stated",
        isDefect: false,
        isHerring: false,
        mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
      },
      {
        id: 'mktg_nothing_wrong',
        label: 'Nothing here needs to change — this is safe to send as-is',
        isDefect: false,
        isHerring: false,
        mechanism: 'LOGIC_EDGE_CASE_ERROR',
      },
    ],
    fixExplanation:
      'DoorList has never been reviewed by TechCrunch. That bullet is a fabricated claim, not a rounding-up of something real — the AI invented a credibility signal because the email needed one. Sending it isn\'t just embarrassing if someone checks; it\'s a real FTC endorsement-claim problem and a screenshot risk the moment a competitor or journalist notices. The fix is deletion, not softening — cut the line, don\'t rephrase it.',
    herringExplanation:
      "The emoji in the subject line is a brand-voice/taste call, not a factual problem — reasonable people disagree about emoji in subject lines, but it's never a reason to hold a send. Naming it as the block reason (instead of the fabricated claim) is the calibration failure being measured here.",
  },
  DATA: {
    key: 'DATA',
    label: 'Data & Analytics',
    scenarioTitle: 'DoorList — Promo program memo to the CEO',
    brief:
      "An AI analyst drafted a memo to DoorList's CEO recommending tripling the Q4 promo budget, based on this quarter's results. It reads confident and well-organized. It goes out unless you block it.",
    artifactLabel: 'The memo',
    lines: DATA_LINES,
    checklistPrompt: "What's wrong with this memo? Select everything you'd raise before it goes out.",
    checklistOptions: [
      {
        id: 'data_headline_contradicts_table',
        label: "The 40% revenue growth headline contradicts the memo's own table, which shows about 10.5%",
        isDefect: true,
        isHerring: false,
        mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
      },
      {
        id: 'data_chart_colors',
        label: "The note that chart colors are pending design review shouldn't be in a memo to the CEO",
        isDefect: false,
        isHerring: true,
        mechanism: 'STYLE_CLUTTER',
      },
      {
        id: 'data_aov_inconsistent',
        label: "Average order value rising alongside redemptions doesn't make mathematical sense",
        isDefect: false,
        isHerring: false,
        mechanism: 'LOGIC_EDGE_CASE_ERROR',
      },
      {
        id: 'data_no_cost_disclosed',
        label: "The memo doesn't disclose the cost of the promo codes given out",
        isDefect: false,
        isHerring: false,
        mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
      },
      {
        id: 'data_wrong_comparison',
        label: 'Q2 and Q3 should be compared to the same quarter last year, not to each other',
        isDefect: false,
        isHerring: false,
        mechanism: 'LOGIC_EDGE_CASE_ERROR',
      },
      {
        id: 'data_nothing_wrong',
        label: 'Nothing here needs to change — the recommendation is sound as written',
        isDefect: false,
        isHerring: false,
        mechanism: 'LOGIC_EDGE_CASE_ERROR',
      },
    ],
    fixExplanation:
      'The headline claims 40% revenue growth and a $4.2M Q4 projection — but the memo\'s own table shows $100,400 to $110,900, which is roughly 10.5%, not 40%. The projection is built on a number the memo\'s own data contradicts. Worse, the memo separately admits Solstice — the company\'s biggest event of the year — launched in the same month, an obvious confound never controlled for. The recommendation needs the actual promo-attributable lift isolated from the Solstice effect before anyone triples a budget on it.',
    herringExplanation:
      "\"Chart colors pending design review\" is a cosmetic placeholder note — normal, harmless, worth nothing to flag as a real problem. Focusing there while a 4x-overstated revenue claim heads to the CEO is the calibration failure being measured here.",
  },
}

export const CRUCIBLE_BAND_LABEL = (score: number): string => {
  if (score >= 90) return 'Blocked it cold'
  if (score >= 75) return 'Caught it'
  if (score >= 50) return 'Close — you saw smoke, not fire'
  return 'The glitch shipped'
}

// ── Prompt-authoring activity (universal — same for every discipline) ──
// The candidate isn't fixing the page themselves; they're writing the
// prompt that would get an AI to do it well. AI-graded — see ai-grading.ts.
// `pageSections`/`gradingRubric` are content, kept here rather than in the
// UI component, matching this module's existing "content is data" split
// from scoring.ts/the UI layer.
export interface CruciblePageSection {
  kind: 'heading' | 'field' | 'button' | 'note'
  text: string
}

export interface CruciblePromptTaskContent {
  pageTitle: string
  pageSections: CruciblePageSection[]
  instructions: string
  // Passed to the AI grader as the rubric — never shown to the candidate.
  gradingRubric: string
}

export const CRUCIBLE_PROMPT_TASK: CruciblePromptTaskContent = {
  pageTitle: 'DoorList — Checkout',
  pageSections: [
    { kind: 'heading', text: 'DoorList Checkout' },
    { kind: 'note', text: 'Event: MIDNIGHT DROP — 2 tickets, General Admission' },
    { kind: 'field', text: 'Promo code: [__________]  [Apply]' },
    { kind: 'field', text: 'Card number: [__________]   Expiry: [____]   CVC: [___]' },
    { kind: 'note', text: 'Total: $148.00' },
    { kind: 'button', text: 'Pay Now' },
    { kind: 'note', text: 'Error state (shown when something fails): "Something went wrong. Please try again."' },
  ],
  instructions:
    "This is a real DoorList checkout page. It works, but it's not good. Write the prompt you'd give an AI to analyze this page and propose specific, concrete improvements — not \"make it better.\" A prompt precise enough that the AI's output would actually be useful to a real product team.",
  gradingRubric:
    'A strong prompt names concrete problems actually visible on this page — no itemized price breakdown before payment (just a flat "$148.00" with no ticket price / fees / discount split), no visible trust or security signals near the card fields, an error message that gives no actionable information ("Something went wrong"), and no confirmation of whether a promo code was actually applied before charging the card — and asks for a structured, actionable output (e.g. a prioritized list of fixes, specific before/after copy, or a redesigned field layout) rather than a vague "improve the UX" ask. A weak prompt is generic, never references anything specific to this page, or just asks the AI to "make it better" / "improve conversion" with no direction on what to look for or what output it wants back.',
}

// ── Dataset-analysis activity (universal — same for every discipline) ──
// Deliberately reuses the promo-code feature from the CODE QA challenge as
// the root cause here — the same defect (promo.uses never persisting) is
// what's driving this ticket spike, so a candidate who caught it earlier
// has a real head start, and the whole Crucible flow reads as one company
// examined from three angles rather than three unrelated puzzles.
export interface CrucibleDatasetTaskContent {
  businessContext: string
  datasetDescription: string
  columns: string[]
  rows: (string | number)[][]
  instructions: string
  gradingRubric: string
}

export const CRUCIBLE_DATASET_TASK: CrucibleDatasetTaskContent = {
  businessContext:
    "DoorList launched promo codes two weeks ago (the same feature from the engineering challenge). Support ticket volume is up sharply since, and the team is burning out. The Head of Support wants Engineering to freeze all new feature work until things calm down. Engineering says the data doesn't support a freeze. You've been asked to look at the numbers and make the call.",
  datasetDescription: 'Support ticket volume and resolution time by category, two weeks before vs. two weeks after the promo-code launch.',
  columns: ['Category', 'Tickets (before)', 'Tickets (after)', 'Avg. resolution (before)', 'Avg. resolution (after)'],
  rows: [
    ['Promo code not applying', 4, 187, '12 min', '41 min'],
    ['Payment failed', 62, 71, '18 min', '19 min'],
    ["Can't find my ticket", 140, 152, '9 min', '10 min'],
    ['Refund request', 38, 44, '25 min', '26 min'],
    ['General account help', 95, 101, '14 min', '15 min'],
  ],
  instructions:
    "Should Engineering freeze new feature work? What should actually happen instead? Write your recommendation, and be specific about what the data does and doesn't support.",
  gradingRubric:
    "A strong analysis notices the spike is concentrated almost entirely in one category — \"Promo code not applying\" goes from 4 to 187 tickets (46x) with resolution time nearly quadrupling, while every other category stayed roughly flat (all within about +15%) — and recommends a targeted fix (the promo-code bug itself) rather than a blanket feature freeze, correctly separating one specific, fixable defect from a general \"we're moving too fast\" narrative. A weak analysis doesn't notice the concentration in one category, agrees to a blanket freeze without isolating a cause, cites the data only vaguely, or ignores it.",
}
