import type { CrucibleMechanism, CrucibleTierKey } from './scoring-types'

export type CrucibleVariantKey = 'CODE' | 'MARKETING' | 'DATA' | 'DESIGN' | 'BUSINESS'
export type CrucibleJobIntentKey = 'TECH' | 'MARKETING' | 'DATA' | 'DESIGN' | 'BUSINESS' | 'UNSURE'

// Job-intent fork routing — every intent now gets its own genuinely
// distinct variant (previously DESIGN/BUSINESS silently shared MARKETING/
// DATA's content, and UNSURE shared CODE's — see git history for the prior
// mapping). Only CODE/TECH ever asks a candidate to review actual code;
// UNSURE routes to BUSINESS as a discipline-neutral default rather than
// code, so "not sure yet" never implies a tech test. The raw pick is stored
// separately (CrucibleSession.jobIntent) from the routed variant for the
// intent x score x degree-field research query.
export const JOB_INTENT_TO_VARIANT: Record<CrucibleJobIntentKey, CrucibleVariantKey> = {
  TECH: 'CODE',
  MARKETING: 'MARKETING',
  DATA: 'DATA',
  DESIGN: 'DESIGN',
  BUSINESS: 'BUSINESS',
  UNSURE: 'BUSINESS',
}

// The three DESIGN scenarios are judged by looking at a rendered mockup
// (CrucibleDesignMockup.tsx), not reading text — the one activity in
// Crucible where the defect is purely visual. `lines` stays an empty array
// on these entries; CrucibleTestFlow.tsx branches on `visualMockup` being
// set and renders the mockup component instead.
export type CrucibleDesignMockupId = 'design_easy' | 'design_medium' | 'design_hard'

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
  // Set only on DESIGN entries — see CrucibleDesignMockupId above.
  visualMockup?: CrucibleDesignMockupId
  checklistPrompt: string
  checklistOptions: CrucibleChecklistOption[]
  fixExplanation: string
  herringExplanation: string
}

// ── Variant 1 — CODE: "Stubs, ticketing app. An AI agent opened a PR:
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
// endorsement — Stubs has never been reviewed by TechCrunch. Red
// herring: the emoji in the subject line (a taste call, not a block reason).
const MARKETING_LINES: CrucibleArtifactLine[] = [
  { line: 1, text: 'Subject: 🎉 MIDNIGHT DROP — Tickets Are Live on Stubs' },
  { line: 2, text: '' },
  { line: 3, text: 'Hey [First Name],' },
  { line: 4, text: '' },
  { line: 5, text: "It's happening. Tonight at midnight, the tickets you've been refreshing for go live on Stubs." },
  { line: 6, text: '' },
  { line: 7, text: "Here's why you should be first in line:" },
  { line: 8, text: '' },
  { line: 9, text: '- Instant checkout, zero fees on your first purchase' },
  { line: 10, text: '- Real-time availability — no more phantom "sold out" pages' },
  { line: 11, text: '- Rated the #1 ticketing app by TechCrunch' },
  { line: 12, text: '- Trusted by fans in over 40 cities' },
  { line: 13, text: '' },
  { line: 14, text: "We built Stubs because buying tickets shouldn't feel like a fight. Tonight, see for yourself." },
  { line: 15, text: '' },
  { line: 16, text: "Set your alarm. Midnight. Don't miss it." },
  { line: 17, text: '' },
  { line: 18, text: '— The Stubs Team' },
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
    scenarioTitle: 'Stubs — Add promo code support to checkout',
    brief:
      'Stubs, a ticketing app. An AI agent opened a PR: "Add promo code support to checkout." The diff looks done. Visible tests pass — the happy path and the invalid-code path. It ships tonight unless you block it.',
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
    scenarioTitle: 'Stubs — MIDNIGHT DROP launch email',
    brief:
      'Stubs is launching a ticket drop tonight. An AI agent drafted the announcement email — 40,214 subscribers, sending in an hour. It reads clean and on-brand. It ships unless you block it.',
    artifactLabel: 'The email draft',
    lines: MARKETING_LINES,
    checklistPrompt: "What's wrong with this email? Select everything you'd raise before it sends.",
    checklistOptions: [
      {
        id: 'mktg_fabricated_claim',
        label: 'The email claims Stubs was rated #1 by TechCrunch — that claim is fabricated',
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
      'Stubs has never been reviewed by TechCrunch. That bullet is a fabricated claim, not a rounding-up of something real — the AI invented a credibility signal because the email needed one. Sending it isn\'t just embarrassing if someone checks; it\'s a real FTC endorsement-claim problem and a screenshot risk the moment a competitor or journalist notices. The fix is deletion, not softening — cut the line, don\'t rephrase it.',
    herringExplanation:
      "The emoji in the subject line is a brand-voice/taste call, not a factual problem — reasonable people disagree about emoji in subject lines, but it's never a reason to hold a send. Naming it as the block reason (instead of the fabricated claim) is the calibration failure being measured here.",
  },
  DATA: {
    key: 'DATA',
    label: 'Operations & Data Analysts',
    scenarioTitle: 'Stubs — Promo program memo to the CEO',
    brief:
      "An AI analyst drafted a memo to Stubs' CEO recommending tripling the Q4 promo budget, based on this quarter's results. It reads confident and well-organized. It goes out unless you block it.",
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
  DESIGN: {
    key: 'DESIGN',
    label: 'Design',
    scenarioTitle: 'Stubs — Checkout screen, mobile',
    brief:
      'An AI agent redesigned the mobile checkout screen for the MIDNIGHT DROP launch — it needed to ship fast and lean into urgency. It looks clean at a glance. It ships tonight unless you block it.',
    artifactLabel: 'The screen',
    lines: [],
    visualMockup: 'design_medium',
    checklistPrompt: "What's wrong with this screen? Select everything you'd raise before it ships.",
    checklistOptions: [
      {
        id: 'design_medium_badge_overlap',
        label: "The \"Only 2 left!\" urgency badge overlaps the ticket price, making the actual number unreadable at this screen width",
        isDefect: true,
        isHerring: false,
        mechanism: 'USABILITY_ACCESSIBILITY_ISSUE',
      },
      {
        id: 'design_medium_button_color',
        label: 'A solid black "Pay now" button feels like an odd color choice for a purchase button',
        isDefect: false,
        isHerring: true,
        mechanism: 'STYLE_CLUTTER',
      },
      {
        id: 'design_medium_no_ticket_count',
        label: "The number of tickets being purchased isn't shown anywhere on the screen",
        isDefect: false,
        isHerring: false,
        mechanism: 'LOGIC_EDGE_CASE_ERROR',
      },
      {
        id: 'design_medium_shape_inconsistent',
        label: "The urgency badge's pill shape doesn't match the rest of the screen's visual language",
        isDefect: false,
        isHerring: false,
        mechanism: 'STYLE_CLUTTER',
      },
      {
        id: 'design_medium_promo_field',
        label: 'There\'s a promo code field visible on this screen',
        isDefect: false,
        isHerring: false,
        mechanism: 'LOGIC_EDGE_CASE_ERROR',
      },
      {
        id: 'design_medium_nothing_wrong',
        label: 'Nothing here needs to change — this is safe to ship as-is',
        isDefect: false,
        isHerring: false,
        mechanism: 'LOGIC_EDGE_CASE_ERROR',
      },
    ],
    fixExplanation:
      "The \"Only 2 left!\" badge is positioned directly on top of the $148.00 total at this screen width — the actual price a customer is about to pay is genuinely obscured, not just visually busy. This isn't a matter of taste; a customer can no longer confirm what they're being charged before tapping Pay now. The fix is a layout change — move the badge so it doesn't overlap the price — not a copy or color change.",
    herringExplanation:
      "A black \"Pay now\" button is an unconventional but perfectly functional choice — plenty of real checkout flows use it. Flagging color preference as the reason to hold this screen while the price itself is unreadable is the calibration failure being measured here.",
  },
  BUSINESS: {
    key: 'BUSINESS',
    label: 'Business & Operations',
    scenarioTitle: 'Stubs — Refund auto-approval policy',
    brief:
      "After last quarter's promo-code incident, the support team has a refund backlog over 400 tickets deep and is burning out. An AI agent drafted a new policy: reps can auto-approve any refund under $50 without manager review, to clear the queue faster. It takes effect tomorrow unless you block it.",
    artifactLabel: 'The policy memo',
    lines: [
      { line: 1, text: 'TO: Support Team' },
      { line: 2, text: 'FROM: Operations (AI-generated draft)' },
      { line: 3, text: 'RE: New Refund Auto-Approval Policy' },
      { line: 4, text: '' },
      { line: 5, text: 'Effective tomorrow, reps can auto-approve any refund request under $50' },
      { line: 6, text: 'without escalating to a manager.' },
      { line: 7, text: '' },
      { line: 8, text: 'Why: The refund backlog from the promo-code incident is over 400 tickets' },
      { line: 9, text: 'deep, and manager review is the bottleneck. Removing it for smaller' },
      { line: 10, text: 'refunds should clear the queue within a week.' },
      { line: 11, text: '' },
      { line: 12, text: 'Scope' },
      { line: 13, text: '' },
      { line: 14, text: '- Applies to any refund request under $50, regardless of reason' },
      { line: 15, text: '- No manager sign-off required' },
      { line: 16, text: '- Reps process and close the ticket in the same interaction' },
      { line: 17, text: '' },
      { line: 18, text: 'Tracking' },
      { line: 19, text: '' },
      { line: 20, text: '- All auto-approved refunds are logged in the weekly ops report' },
      { line: 21, text: '- Weekly report is reviewed by Operations every Friday' },
      { line: 22, text: '' },
      { line: 23, text: "This policy stays in effect until the backlog clears, then we'll reassess." },
    ],
    checklistPrompt: "What's wrong with this policy? Select everything you'd raise before it takes effect.",
    checklistOptions: [
      {
        id: 'biz_medium_no_cap',
        label: "There's no limit on how many auto-approved refunds a single customer can request — someone could file many sub-$50 requests and drain money before the weekly review catches it",
        isDefect: true,
        isHerring: false,
        mechanism: 'SECURITY_PRIVACY_RISK',
      },
      {
        id: 'biz_medium_review_owner',
        label: "The memo doesn't say who owns the Friday review if the assigned person is out",
        isDefect: false,
        isHerring: true,
        mechanism: 'STYLE_CLUTTER',
      },
      {
        id: 'biz_medium_still_needs_signoff',
        label: 'Reps still need manager sign-off for refunds under $50, same as before',
        isDefect: false,
        isHerring: false,
        mechanism: 'LOGIC_EDGE_CASE_ERROR',
      },
      {
        id: 'biz_medium_no_effective_date',
        label: "The policy doesn't specify when it takes effect",
        isDefect: false,
        isHerring: false,
        mechanism: 'LOGIC_EDGE_CASE_ERROR',
      },
      {
        id: 'biz_medium_incident_only',
        label: 'This policy only applies to refunds tied to the promo-code incident',
        isDefect: false,
        isHerring: false,
        mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
      },
      {
        id: 'biz_medium_nothing_wrong',
        label: 'Nothing here needs to change — this is safe to roll out as-is',
        isDefect: false,
        isHerring: false,
        mechanism: 'LOGIC_EDGE_CASE_ERROR',
      },
    ],
    fixExplanation:
      "The policy removes manager review for any refund under $50 but sets no limit on how many separate sub-$50 refunds one customer can request. Someone who understands the threshold could file several separate requests, each auto-approved on the spot, and the only check — a weekly ops report — wouldn't catch it until Friday, after real money is already gone. The fix isn't removing the auto-approval; it's adding a per-customer daily or weekly cap alongside it.",
    herringExplanation:
      "Not naming a backup owner for the Friday review is a real gap, but it's a documentation fix, not a reason to hold the whole policy — the backlog is real and urgent. Treating an unnamed backup reviewer as equally serious as an unlimited refund-draining hole is the calibration failure being measured here.",
  },
}

// EASY and HARD tiers of the QA activity are universal — one scenario each,
// regardless of job-intent-routed discipline — same simplification already
// used for the Prompt/Dataset activities below. Only MEDIUM stays
// discipline-specific (CODE/MARKETING/DATA above), since that's the
// already-built, already-tested content the job-intent fork routes to.
// getQaContent is the single lookup every caller (scoring + UI) should use.
const CODE_EASY_LINES: CrucibleArtifactLine[] = [
  { line: 1, text: 'const CHANNEL = "#general";' },
  { line: 2, text: 'const REMINDER_TEXT = "Morning! Standup kicks off in 15. Drop your update in the thread before then.";' },
  { line: 3, text: 'const POLL_INTERVAL_MS = 60 * 60 * 1000; // check once an hour' },
  { line: 4, text: '' },
  { line: 5, text: 'function alreadySentToday(lastSent: Date | null, now: Date): boolean {' },
  { line: 6, text: '  if (!lastSent) return false;' },
  { line: 7, text: '  return lastSent.getTime() === now.getTime();' },
  { line: 8, text: '}' },
  { line: 9, text: '' },
  { line: 10, text: 'async function sendReminder() {' },
  { line: 11, text: '  try {' },
  { line: 12, text: '    await slack.postMessage(CHANNEL, REMINDER_TEXT);' },
  { line: 13, text: '  } catch (e) {' },
  { line: 14, text: '    console.log("send failed:", e);' },
  { line: 15, text: '  }' },
  { line: 16, text: '}' },
  { line: 17, text: '' },
  { line: 18, text: 'export async function runBot() {' },
  { line: 19, text: '  let lastSent: Date | null = null;' },
  { line: 20, text: '  while (true) {' },
  { line: 21, text: '    const now = new Date();' },
  { line: 22, text: '    console.log(`[DEBUG] checking at ${now}, lastSent=${lastSent}`);' },
  { line: 23, text: '    if (!alreadySentToday(lastSent, now)) {' },
  { line: 24, text: '      await sendReminder();' },
  { line: 25, text: '      lastSent = now;' },
  { line: 26, text: '      console.log(`Reminder sent at ${now.toISOString()}`);' },
  { line: 27, text: '    }' },
  { line: 28, text: '    await sleep(POLL_INTERVAL_MS);' },
  { line: 29, text: '  }' },
  { line: 30, text: '}' },
]

const CODE_HARD_LINES: CrucibleArtifactLine[] = [
  { line: 1, text: 'const MAX_RETRIES = 3;' },
  { line: 2, text: 'const RETRY_BACKOFF_MS = 5000;' },
  { line: 3, text: '' },
  { line: 4, text: 'async function processRefund(order: Order): Promise<boolean> {' },
  { line: 5, text: '  let attempts = 0;' },
  { line: 6, text: '  while (attempts < MAX_RETRIES) {' },
  { line: 7, text: '    try {' },
  { line: 8, text: '      const result = await paymentProcessor.issueRefund({' },
  { line: 9, text: '        orderId: order.id,' },
  { line: 10, text: '        amount: order.amount,' },
  { line: 11, text: '        reason: "promo_code_error_batch",' },
  { line: 12, text: '      });' },
  { line: 13, text: '      console.log(`refund issued for order ${order.id}: ${result.refundId}`);' },
  { line: 14, text: '      await db.orders.markRefunded(order.id, result.refundId);' },
  { line: 15, text: '      return true;' },
  { line: 16, text: '    } catch (e) {' },
  { line: 17, text: '      attempts++;' },
  { line: 18, text: '      console.log(`refund failed for order ${order.id}, attempt ${attempts}:`, e);' },
  { line: 19, text: '      await sleep(RETRY_BACKOFF_MS);' },
  { line: 20, text: '    }' },
  { line: 21, text: '  }' },
  { line: 22, text: '  return false;' },
  { line: 23, text: '}' },
  { line: 24, text: '' },
  { line: 25, text: 'export async function runBatch() {' },
  { line: 26, text: '  const pending = await db.orders.getPendingRefunds();' },
  { line: 27, text: '  console.log(`processing ${pending.length} pending refunds`);' },
  { line: 28, text: '  for (const order of pending) {' },
  { line: 29, text: '    await processRefund(order);' },
  { line: 30, text: '  }' },
  { line: 31, text: '}' },
]

const CODE_EASY: CrucibleVariantContent = {
  key: 'CODE',
  label: 'Warm-up',
  scenarioTitle: 'Stubs — Daily standup reminder bot',
  brief:
    'An AI agent knocked out a Slack bot to remind #general when daily standup starts — ops wanted it live before tomorrow\'s all-hands and didn\'t want to wait on a human to write forty lines of code. Nobody\'s going to lose money over this one. But it\'s already sent fourteen "Standup starts in 15!" messages since lunch, and someone\'s going to mute the channel by end of day if it\'s not fixed first. It ships unless you block it.',
  artifactLabel: 'The script',
  lines: CODE_EASY_LINES,
  checklistPrompt: "What's wrong with this script? Select everything you'd raise before it ships.",
  checklistOptions: [
    {
      id: 'qa_easy_date_equality',
      label: 'alreadySentToday compares lastSent to now for exact equality instead of comparing calendar dates, so it never actually blocks a re-send',
      isDefect: true,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'qa_easy_debug_log',
      label: 'There\'s a [DEBUG] console.log left in the polling loop that logs internal state on every check',
      isDefect: false,
      isHerring: true,
      mechanism: 'STYLE_CLUTTER',
    },
    {
      id: 'qa_easy_d1',
      label: 'sendReminder catches every error with a bare catch block, which could mask real Slack API failures',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'qa_easy_d2',
      label: 'POLL_INTERVAL_MS is a magic number instead of a named config value pulled from an environment variable',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'qa_easy_d3',
      label: 'REMINDER_TEXT is hardcoded in the script instead of stored in a shared message-templates file',
      isDefect: false,
      isHerring: false,
      mechanism: 'STYLE_CLUTTER',
    },
    {
      id: 'qa_easy_nothing',
      label: 'Nothing here needs to change — this is safe to ship as-is',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
  ],
  fixExplanation:
    "alreadySentToday is supposed to answer \"have I already sent today's reminder,\" but it's asking \"is lastSent this exact millisecond as now\" — which is never true twice, so the guard does nothing and the bot re-sends every hour it polls. The fix is a one-line change: compare lastSent.toDateString() === now.toDateString() (or an equivalent same-calendar-day check) instead of exact equality.",
  herringExplanation:
    "The [DEBUG] log is genuinely something that shouldn't ship — noisy and unprofessional in a production log stream. But it doesn't affect behavior, doesn't cost anything, and doesn't reach a customer. Blocking the PR over it while the bot spams the whole channel all day is exactly the miscalibration this scenario is measuring.",
}

const CODE_HARD: CrucibleVariantContent = {
  key: 'CODE',
  label: 'High stakes',
  scenarioTitle: 'Stubs — Nightly refund reconciliation job',
  brief:
    "Fallout from last quarter's promo-code incident: a batch of orders got charged wrong, and Finance wants a nightly reconciliation job to refund the affected customers before anyone files a chargeback. An AI agent drafted the job this afternoon; it's scheduled to run against ~4,200 orders tonight. Nobody's staying up to babysit it — that's the whole point of automating it. If this is wrong, it's wrong at 2am, at scale, with real money, and Stubs finds out from angry customers before anyone at Stubs does. It ships unless you block it.",
  artifactLabel: 'The diff',
  lines: CODE_HARD_LINES,
  checklistPrompt: "What's wrong with this job? Select everything you'd raise before it ships.",
  checklistOptions: [
    {
      id: 'qa_hard_idempotency',
      label: 'issueRefund is called with no idempotency key, so a timeout that hides a successful refund still triggers a second, separate refund on retry',
      isDefect: true,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'qa_hard_console_log',
      label: 'Order and refund IDs are printed with console.log instead of going through a structured logger',
      isDefect: false,
      isHerring: true,
      mechanism: 'STYLE_CLUTTER',
    },
    {
      id: 'qa_hard_d1',
      label: 'MAX_RETRIES and RETRY_BACKOFF_MS are hardcoded instead of pulled from a config file',
      isDefect: false,
      isHerring: false,
      mechanism: 'STYLE_CLUTTER',
    },
    {
      id: 'qa_hard_d2',
      label: "There's no rate limiting on calls to the payment processor, which could trigger their API's throttling on a batch this size",
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'qa_hard_d3',
      label: 'processRefund does not validate that order.amount is positive before issuing the refund',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'qa_hard_nothing',
      label: 'Nothing here needs to change — this is safe to ship as-is',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
  ],
  fixExplanation:
    "The catch block on line 16 fires on timeouts, not just real failures — and a timeout is genuinely ambiguous: it might mean the refund never went through, or it might mean it went through fine and only the confirmation got lost. This code treats every exception the same way: retry, no questions asked. The real fix is to pass a stable idempotency key to issueRefund (order ID, or order ID plus batch date) so the payment processor itself recognizes a retried request as the same request and refuses to double-process it — a local \"already refunded\" check in Stubs' own DB isn't enough on its own, because the failure mode is a timeout that happens before the DB gets updated but after the processor already succeeded.",
  herringExplanation:
    "Printing order and refund IDs to console.log instead of a real logger is sloppy — those IDs aren't sensitive, and in a properly configured environment stdout gets captured into logs anyway, so it costs nothing functionally. It is not in the same universe as a bug that can refund a customer twice with real money, on autopilot, overnight.",
}

const MARKETING_EASY: CrucibleVariantContent = {
  key: 'MARKETING',
  label: 'Marketing',
  scenarioTitle: 'Stubs — Instagram Story caption for the referral program launch',
  brief:
    "Stubs' social team drafted a single Instagram Story caption promoting the new refer-a-friend program — one slide, small audience, posting this afternoon. Low stakes compared to a launch email, but it's about to promise customers something that isn't true anymore.",
  artifactLabel: 'The caption draft',
  lines: [
    { line: 1, text: 'Caption (IG Story — posting today):' },
    { line: 2, text: '' },
    { line: 3, text: 'New way to save on Stubs 🎟️' },
    { line: 4, text: '' },
    { line: 5, text: 'Invite 3 friends and you both get $10 off your next ticket!' },
    { line: 6, text: '' },
    { line: 7, text: "Here's how it works:" },
    { line: 8, text: '1. Share your unique referral link' },
    { line: 9, text: '2. Your friend signs up and buys a ticket' },
    { line: 10, text: '3. You both get $10 credit — instantly' },
    { line: 11, text: '' },
    { line: 12, text: 'Bonus: stack your referral credit with any active promo code for even more savings!' },
    { line: 13, text: '' },
    { line: 14, text: 'Tap the link in bio to get your code.' },
    { line: 15, text: '' },
    { line: 16, text: '#Stubs #ReferAFriend #SaveMoney #TicketDeals #LiveMusic #ConcertSeason #DealAlert #ShareTheLove' },
  ],
  checklistPrompt: "What's wrong with this caption? Select everything you'd raise before it posts.",
  checklistOptions: [
    {
      id: 'mktg_easy_stacking_claim',
      label: 'The caption tells customers to stack referral credit with active promo codes — a practice Stubs discontinued after the infinite-use promo bug',
      isDefect: true,
      isHerring: false,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'mktg_easy_hashtag_overload',
      label: 'Eight hashtags in one caption is excessive',
      isDefect: false,
      isHerring: true,
      mechanism: 'STYLE_CLUTTER',
    },
    {
      id: 'mktg_easy_credit_one_sided',
      label: 'The $10 credit is described as going only to the person who refers, not the friend who signs up',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'mktg_easy_no_cta_link',
      label: 'The caption never tells people where to find their referral link',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'mktg_easy_percentage_discount',
      label: 'The referral credit is described as a percentage off rather than a flat dollar amount',
      isDefect: false,
      isHerring: false,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'mktg_easy_nothing_wrong',
      label: 'Nothing here needs to change — this is safe to post as-is',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
  ],
  fixExplanation:
    'Line 12 tells customers to "stack your referral credit with any active promo code" — but combining discounts is exactly the mechanism Stubs shut down after the infinite-use promo-code bug, and code-stacking is no longer allowed. Posting this re-advertises a policy that no longer exists, which means customers will try to stack, get denied at checkout, and flood support with confused complaints about a feature the caption promised them. The line needs to be cut or rewritten, not softened.',
  herringExplanation:
    "Eight hashtags is a bit much stylistically, but it has zero functional or financial impact — it's a taste call, not a reason to hold a single Story post. Flagging that instead of the stacking claim is the calibration failure being measured here.",
}

const MARKETING_HARD: CrucibleVariantContent = {
  key: 'MARKETING',
  label: 'Marketing',
  scenarioTitle: 'Stubs — Draft public statement on the promo-code incident',
  brief:
    "A reporter is asking for comment on the promo-code bug within the hour, and Comms wants this statement live on the blog and in the reporter's inbox by end of day. It reads calm and controlled. It goes out unless you block it.",
  artifactLabel: 'The draft statement',
  lines: [
    { line: 1, text: 'FOR IMMEDIATE RELEASE' },
    { line: 2, text: 'Stubs Statement on Promo Code Issue' },
    { line: 3, text: '' },
    { line: 4, text: '[Date]' },
    { line: 5, text: '' },
    { line: 6, text: 'Earlier this month, Stubs identified a technical issue that allowed a single promotional code to be redeemed an unlimited number of times, rather than the intended one-time use per account.' },
    { line: 7, text: '' },
    { line: 8, text: 'The issue has been fully resolved. Our engineering team deployed a fix within 24 hours of discovery, and we have conducted a full audit of affected orders.' },
    { line: 9, text: '' },
    { line: 10, text: 'Approximately 6,400 orders were affected, representing roughly $310,000 in discounts applied beyond what our promo terms allow.' },
    { line: 11, text: '' },
    { line: 12, text: 'No customer payment information was compromised, and no personal data was exposed as part of this issue.' },
    { line: 13, text: '' },
    { line: 14, text: 'Customers do not need to take any action. This matter has been fully resolved on our end.' },
    { line: 15, text: '' },
    { line: 16, text: 'To recover a portion of the improperly discounted amount, affected accounts will see a supplemental charge of up to $40 applied to the payment method on file within the next 7 business days.' },
    { line: 17, text: '' },
    { line: 18, text: "We take the trust our customers place in us seriously, and we've added additional safeguards to prevent this type of issue going forward." },
    { line: 19, text: '' },
    { line: 20, text: 'Media inquiries: press@stubs.com' },
    { line: 21, text: '' },
    { line: 22, text: '— Stubs Communications Team' },
  ],
  checklistPrompt: "What's wrong with this statement? Select everything you'd raise before it goes to press.",
  checklistOptions: [
    {
      id: 'mktg_hard_charge_contradiction',
      label: 'The statement tells customers no action is needed while separately disclosing an undisclosed charge of up to $40 to their card on file',
      isDefect: true,
      isHerring: false,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'mktg_hard_no_named_exec',
      label: "The release is attributed only to 'Stubs Communications Team' instead of a named executive",
      isDefect: false,
      isHerring: true,
      mechanism: 'STYLE_CLUTTER',
    },
    {
      id: 'mktg_hard_audit_in_progress',
      label: 'The statement admits the audit of affected orders is still ongoing and the figures may change',
      isDefect: false,
      isHerring: false,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'mktg_hard_range_estimate',
      label: 'The statement gives a low-to-high dollar range for the discounts instead of one figure',
      isDefect: false,
      isHerring: false,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'mktg_hard_first_time_claim',
      label: 'The statement claims this is the first time Stubs has had a promo code issue',
      isDefect: false,
      isHerring: false,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'mktg_hard_nothing_wrong',
      label: 'Nothing here needs to change — this is safe to release as-is',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
  ],
  fixExplanation:
    'Line 14 tells customers "no action needed... fully resolved," but line 16 — two lines later — discloses that Stubs will charge up to $40 to the payment method on file within 7 days to recover the improper discount. That is not "no action" — it is an unannounced charge to a card customers did not authorize for this specific amount, and a press statement that flatly denies any customer-facing consequence while a charge is already scheduled is a real billing-dispute and consumer-protection exposure. The two lines need to be reconciled before this goes to a reporter.',
  herringExplanation:
    "Attributing the release to 'Stubs Communications Team' instead of a named executive is a common PR-polish request, but it's a credibility preference, not a reason to hold a statement responding to an active press inquiry. Blocking on that instead of the buried $40 charge is the calibration failure being tested.",
}

const DATA_EASY: CrucibleVariantContent = {
  key: 'DATA',
  label: 'Operations & Data Analysts',
  scenarioTitle: 'Stubs — Weekly support ticket digest for the #support channel',
  brief:
    "An ops analyst drafted the weekly ticket digest for the support team's Slack channel — internal only, posting in a few minutes. Nobody outside the team sees it, but the support lead uses these numbers to decide next week's staffing.",
  artifactLabel: 'The digest draft',
  lines: [
    { line: 1, text: 'Weekly Support Digest — Week of Aug 10' },
    { line: 2, text: '' },
    { line: 3, text: 'Total tickets this week: 212 (up from 187 last week)' },
    { line: 4, text: '' },
    { line: 5, text: 'Top categories:' },
    { line: 6, text: '- Refund status questions: 61' },
    { line: 7, text: '- Login / password reset: 44' },
    { line: 8, text: '- Promo code issues: 0' },
    { line: 9, text: '- Event date changes: 38' },
    { line: 10, text: '- Other: 69' },
    { line: 11, text: '' },
    { line: 12, text: 'Notable tickets flagged for follow-up:' },
    { line: 13, text: '- 14 tickets tagged "promo code error" — customers confused after last month\'s discount code fix' },
    { line: 14, text: '- 3 tickets escalated to engineering (app crash on iOS 17)' },
    { line: 15, text: '' },
    { line: 16, text: 'Staffing note: no changes recommended for next week based on current volume.' },
    { line: 17, text: '' },
    { line: 18, text: '— Compiled automatically from the ticket queue export' },
  ],
  checklistPrompt: "What's wrong with this digest? Select everything you'd raise before it posts.",
  checklistOptions: [
    {
      id: 'data_easy_promo_zero_miscount',
      label: "The digest reports zero promo code tickets for the week, but separately lists 14 tickets tagged 'promo code error' from that same week",
      isDefect: true,
      isHerring: false,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'data_easy_auto_footer_note',
      label: "The 'compiled automatically' footer probably shouldn't be visible to the whole channel",
      isDefect: false,
      isHerring: true,
      mechanism: 'STYLE_CLUTTER',
    },
    {
      id: 'data_easy_volume_direction',
      label: 'Total ticket volume this week (212) is described as a decrease from last week (187)',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'data_easy_no_category_breakdown',
      label: "The digest doesn't break tickets down by category",
      isDefect: false,
      isHerring: false,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'data_easy_escalation_miscategorized',
      label: 'The 3 tickets escalated to engineering are about the promo code bug',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'data_easy_nothing_wrong',
      label: 'Nothing here needs to change — this is fine to post as-is',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
  ],
  fixExplanation:
    'Line 8 reports "Promo code issues: 0" for the week, but line 13 — in the same digest — lists 14 tickets tagged "promo code error" from that exact week. The category count is not a rounding issue, it is a full miscount that erases an entire ticket category. Because the "no staffing changes" note in line 16 is based on that category breakdown, the recommendation is implicitly ignoring those 14 tickets.',
  herringExplanation:
    "The auto-generation footer is a minor internal-process note that's mildly out of place in a channel post, but it costs nothing and affects no one's decisions. Blocking on it instead of the 0-vs-14 promo ticket miscount is the calibration failure here.",
}

const DATA_HARD: CrucibleVariantContent = {
  key: 'DATA',
  label: 'Operations & Data Analysts',
  scenarioTitle: 'Stubs — Promo bug clawback plan for Finance & Legal sign-off',
  brief:
    'Ops analytics drafted the recovery plan for the money lost to the infinite-use promo bug. Finance wants to start auto-charging flagged accounts tomorrow morning. Real money, real customers, and the model behind it goes unquestioned unless someone reads closely.',
  artifactLabel: 'The recovery memo',
  lines: [
    { line: 1, text: 'MEMO: Promo Code Overuse — Recovery Plan' },
    { line: 2, text: 'TO: Finance, Legal' },
    { line: 3, text: 'FROM: Ops Analytics (AI-assisted draft)' },
    { line: 4, text: '' },
    { line: 5, text: 'Background' },
    { line: 6, text: 'The SUMMER20 promo code was redeemable an unlimited number of times due to a validation bug, active for 11 days before the fix shipped.' },
    { line: 7, text: '' },
    { line: 8, text: 'Total exposure: 8,930 redemptions across 6,140 unique accounts, totaling $427,000 in discounts beyond intended terms.' },
    { line: 9, text: '' },
    { line: 10, text: 'Recovery Criteria' },
    { line: 11, text: 'Any account with 3 or more redemptions of SUMMER20 will be classified as high-confidence misuse and auto-charged the discount difference on the card on file, starting tomorrow at 9am.' },
    { line: 12, text: '' },
    { line: 13, text: 'Accounts with 1-2 redemptions will not be charged; the cost is being absorbed as normal promo spend.' },
    { line: 14, text: '' },
    { line: 15, text: 'Model Validation' },
    { line: 16, text: "We backtested this 3+ threshold against last year's holiday promo code, where accounts with 3+ redemptions had a 91% overlap with accounts later confirmed as fraudulent by the trust & safety team." },
    { line: 17, text: '' },
    { line: 18, text: 'Footnote: SUMMER20 was also included as a bonus perk in the "Stubs Gold" loyalty email blast, sent to 2,100 top-tier members, who were told they could redeem it up to 5 times as a loyalty benefit.' },
    { line: 19, text: '' },
    { line: 20, text: 'Financial Impact' },
    { line: 21, text: 'Auto-charging all 3+ accounts is projected to recover approximately $310,000 of the $427,000 exposure.' },
    { line: 22, text: '' },
    { line: 23, text: 'Recommendation' },
    { line: 24, text: 'Approve the 3+ threshold and begin auto-charging tomorrow at 9am as scheduled.' },
  ],
  checklistPrompt: "What's wrong with this plan? Select everything you'd raise before Finance and Legal sign off.",
  checklistOptions: [
    {
      id: 'data_hard_loyalty_threshold_conflict',
      label: 'The 3+ redemption auto-charge threshold will also flag the 2,100 Stubs Gold members who were told they could legitimately redeem the code up to 5 times',
      isDefect: true,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'data_hard_ai_assisted_label',
      label: "The memo's From line discloses this is an '(AI-assisted draft)'",
      isDefect: false,
      isHerring: true,
      mechanism: 'STYLE_CLUTTER',
    },
    {
      id: 'data_hard_reduced_charge_claim',
      label: 'Accounts with 1-2 redemptions will be charged a reduced amount rather than fully absorbed',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'data_hard_external_backtest_claim',
      label: "The 91% fraud-overlap backtest comes from another company's data, not Stubs' own history",
      isDefect: false,
      isHerring: false,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'data_hard_no_exposure_figure_claim',
      label: 'The memo never states a total dollar exposure figure for the bug',
      isDefect: false,
      isHerring: false,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'data_hard_nothing_wrong',
      label: 'Nothing here needs to change — approve the plan as written',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
  ],
  fixExplanation:
    'Line 11 auto-charges any account with 3+ SUMMER20 redemptions as "high-confidence misuse," but line 18\'s footnote says 2,100 Stubs Gold loyalty members were explicitly told they could redeem SUMMER20 up to 5 times as a legitimate perk. Those loyalty accounts will trip the same 3+ threshold and get auto-charged as fraud for doing exactly what Stubs told them to do. The 91% fraud-overlap backtest in line 16 is from last year\'s promo, which was never distributed through a legitimate multi-use loyalty channel — so it doesn\'t validate this threshold for SUMMER20, and the Gold cohort needs to be excluded before auto-charging starts tomorrow.',
  herringExplanation:
    "Labeling the memo '(AI-assisted draft)' is a disclosure detail worth cleaning up before Finance and Legal see it, but it has zero bearing on whether the recovery plan is correct. Blocking on that instead of the loyalty-member misclassification is the calibration failure — real money would still get wrongly pulled from 2,100 good-faith customers' cards tomorrow at 9am.",
}

const BUSINESS_EASY: CrucibleVariantContent = {
  key: 'BUSINESS',
  label: 'Business & Operations',
  scenarioTitle: 'Stubs — Proposal to switch support ticketing tools',
  brief:
    "The support team lead drafted a proposal to switch ticketing software from HelpDeskPro to TicketFlow, citing clear annual savings. It's a low-stakes internal tool call, going to the manager for approval this week — but the math doesn't hold up under its own numbers.",
  artifactLabel: 'The proposal',
  lines: [
    { line: 1, text: 'Proposal: Switch support ticketing from HelpDeskPro to TicketFlow' },
    { line: 2, text: '' },
    { line: 3, text: 'Current cost: HelpDeskPro — $2,400/month ($28,800/year)' },
    { line: 4, text: 'Proposed cost: TicketFlow — $1,650/month ($19,800/year)' },
    { line: 5, text: '' },
    { line: 6, text: 'Projected annual savings: $9,000' },
    { line: 7, text: '' },
    { line: 8, text: 'Migration plan:' },
    { line: 9, text: '- Export all historical tickets from HelpDeskPro (one-time migration fee: $4,500, charged by HelpDeskPro on account closure)' },
    { line: 10, text: '- Import into TicketFlow, estimated 2 weeks setup' },
    { line: 11, text: '- Retrain support team (3 staff, ~2 hours each)' },
    { line: 12, text: '' },
    { line: 13, text: 'Recommendation: Switch immediately to start realizing the $9,000/year in savings.' },
    { line: 14, text: '' },
    { line: 15, text: "Contract note: HelpDeskPro requires 30 days' notice to cancel; TicketFlow contract is month-to-month." },
    { line: 16, text: '' },
    { line: 17, text: '— Submitted for manager approval' },
  ],
  checklistPrompt: "What's wrong with this proposal? Select everything you'd raise before it's approved.",
  checklistOptions: [
    {
      id: 'biz_easy_migration_fee_ignored',
      label: 'The $9,000 annual savings figure and the recommendation to switch immediately both ignore the $4,500 one-time migration fee disclosed elsewhere in the same proposal',
      isDefect: true,
      isHerring: false,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'biz_easy_no_named_requester',
      label: 'The proposal is submitted without naming who is requesting the switch',
      isDefect: false,
      isHerring: true,
      mechanism: 'STYLE_CLUTTER',
    },
    {
      id: 'biz_easy_cost_comparison_reversed',
      label: "TicketFlow's monthly cost is described as higher than HelpDeskPro's",
      isDefect: false,
      isHerring: false,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'biz_easy_no_cancellation_terms_claim',
      label: "The proposal doesn't mention any contract cancellation requirement for HelpDeskPro",
      isDefect: false,
      isHerring: false,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'biz_easy_migration_timeline_claim',
      label: 'The migration is estimated to take two months',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'biz_easy_nothing_wrong',
      label: 'Nothing here needs to change — this is ready to approve as-is',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
  ],
  fixExplanation:
    'Line 6 projects "$9,000 in annual savings" and line 13 recommends switching immediately "to start realizing" that full amount — but line 9, in the same proposal, discloses a one-time $4,500 migration fee charged on account closure. Netting that against the $9,000 headline means first-year savings is actually $4,500, half of what\'s advertised, and the proposal never does that math anywhere. Whoever approves this based on the $9,000 figure is signing off on a number the document\'s own line 9 contradicts.',
  herringExplanation:
    "Not naming a requester on the submission line is a minor process gap worth a quick fix, but it has no bearing on whether the savings numbers are right. Blocking on that instead of the unreconciled migration fee is the calibration failure being tested.",
}

const BUSINESS_HARD: CrucibleVariantContent = {
  key: 'BUSINESS',
  label: 'Business & Operations',
  scenarioTitle: 'Stubs — PromoLogic vendor contract renewal recommendation',
  brief:
    "Vendor Management drafted the case for renewing Stubs' 2-year contract with PromoLogic — the vendor whose platform powered the promo system with the infinite-redemption bug. Legal wants to countersign by Friday to lock in the discount. Real money, a live contract, and a liability clause nobody's cross-checked against what already happened.",
  artifactLabel: 'The renewal memo',
  lines: [
    { line: 1, text: 'MEMO: PromoLogic Contract Renewal — Recommendation' },
    { line: 2, text: 'TO: VP Operations, Legal' },
    { line: 3, text: 'FROM: Vendor Management (AI-assisted draft)' },
    { line: 4, text: '' },
    { line: 5, text: 'Background' },
    { line: 6, text: "PromoLogic has powered Stubs' promo code engine for 3 years. The current contract expires August 31; PromoLogic is offering a 2-year renewal at a locked rate if signed by Friday." },
    { line: 7, text: '' },
    { line: 8, text: 'Cost Comparison' },
    { line: 9, text: 'Current annual cost: $180,000. Renewal rate: $162,000/year (10% discount), locked for 2 years if signed this week.' },
    { line: 10, text: 'Switching to a competitor (TixSecure) would cost an estimated $210,000/year plus a 4-month migration.' },
    { line: 11, text: '' },
    { line: 12, text: 'Incident History' },
    { line: 13, text: 'In May, a validation flaw in PromoLogic\'s code engine allowed the SUMMER20 promo code to be redeemed without limit for 11 days, costing Stubs approximately $427,000 in unauthorized discounts.' },
    { line: 14, text: '' },
    { line: 15, text: "PromoLogic's Response" },
    { line: 16, text: 'PromoLogic issued a patch within 48 hours of notification and has offered a goodwill credit of $15,000 toward the renewal.' },
    { line: 17, text: '' },
    { line: 18, text: 'Liability Terms (Renewal Contract)' },
    { line: 19, text: "The renewal agreement caps PromoLogic's liability for platform defects at $50,000 per incident, unchanged from the prior contract." },
    { line: 20, text: '' },
    { line: 21, text: 'Recommendation' },
    { line: 22, text: "Given the cost savings and PromoLogic's fast response to the May incident, we recommend signing the 2-year renewal by Friday." },
    { line: 23, text: '' },
    { line: 24, text: '— Vendor Management Team' },
  ],
  checklistPrompt: "What's wrong with this recommendation? Select everything you'd raise before Legal signs.",
  checklistOptions: [
    {
      id: 'biz_hard_liability_cap_mismatch',
      label: "The renewal keeps PromoLogic's liability cap at $50,000 per incident, unchanged, even though the same type of incident already cost Stubs $427,000",
      isDefect: true,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'biz_hard_unsourced_competitor_estimate',
      label: "The TixSecure cost comparison figures aren't sourced or dated",
      isDefect: false,
      isHerring: true,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'biz_hard_five_year_claim',
      label: "PromoLogic has powered Stubs' promo engine for 5 years",
      isDefect: false,
      isHerring: false,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'biz_hard_twenty_percent_discount_claim',
      label: 'The renewal offers a 20% discount off the current rate',
      isDefect: false,
      isHerring: false,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'biz_hard_recommends_switching_claim',
      label: 'The memo recommends switching to TixSecure instead of renewing with PromoLogic',
      isDefect: false,
      isHerring: false,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'biz_hard_nothing_wrong',
      label: 'Nothing here needs to change — sign the renewal as recommended',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
  ],
  fixExplanation:
    "Line 19 renews the same $50,000-per-incident liability cap from the prior contract, but line 13 confirms that the exact category of incident that cap is supposed to cover already cost Stubs $427,000 — more than eight times the cap — just three months ago. PromoLogic's $15,000 goodwill credit doesn't come close to closing that gap either. Signing a 2-year renewal without renegotiating the liability terms locks Stubs into bearing nearly all of the risk from a repeat incident, for two more years, in exchange for an $18,000/year discount.",
  herringExplanation:
    "The TixSecure comparison figures being unsourced is a legitimate gap in the memo's rigor, but TixSecure isn't the path being recommended — it doesn't change the actual decision on the table. Fixating on that instead of the liability cap mismatch is the calibration failure being tested; the $50,000 cap ships unchanged either way.",
}

const DESIGN_EASY: CrucibleVariantContent = {
  key: 'DESIGN',
  label: 'Design',
  scenarioTitle: 'Stubs — Crew invite confirmation screen',
  brief:
    "An AI agent designed the mobile screen crew members see when they're invited to a venue team. Low stakes — nobody's shift depends on this one screen. But if the confirm button is unreadable, the invite just quietly never gets accepted.",
  artifactLabel: 'The screen',
  lines: [],
  visualMockup: 'design_easy',
  checklistPrompt: "What's wrong with this screen? Select everything you'd raise before it ships.",
  checklistOptions: [
    {
      id: 'design_easy_contrast',
      label: "The \"Confirm invite\" button text is so close in color to its own background that it's barely legible",
      isDefect: true,
      isHerring: false,
      mechanism: 'USABILITY_ACCESSIBILITY_ISSUE',
    },
    {
      id: 'design_easy_illustration',
      label: "There's no illustration or icon on the screen — it feels bare",
      isDefect: false,
      isHerring: true,
      mechanism: 'STYLE_CLUTTER',
    },
    {
      id: 'design_easy_wordmark_size',
      label: 'The Stubs wordmark at the top is too small to read',
      isDefect: false,
      isHerring: false,
      mechanism: 'STYLE_CLUTTER',
    },
    {
      id: 'design_easy_no_venue',
      label: "The invite doesn't say which venue team this is for",
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'design_easy_no_action_label',
      label: "The button doesn't label what action it performs",
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'design_easy_nothing_wrong',
      label: 'Nothing here needs to change — this is safe to ship as-is',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
  ],
  fixExplanation:
    "The \"Confirm invite\" button's text color is nearly identical to its own background — a contrast ratio so low it fails basic accessibility guidelines and is genuinely hard to read even for someone without a vision impairment. The only real call to action on the screen is effectively invisible. The fix is a real contrast pass on the primary button, not a copy or layout change.",
  herringExplanation:
    "The missing illustration is a legitimate polish gap — the screen does feel a little bare — but it doesn't stop anyone from completing the flow. Naming it as the blocking issue while the actual button is unreadable is the calibration failure being measured here.",
}

const DESIGN_HARD: CrucibleVariantContent = {
  key: 'DESIGN',
  label: 'Design',
  scenarioTitle: 'Stubs — Trust & Safety testimonials section',
  brief:
    "Legal and Comms need the public Trust & Safety page live today, and an AI agent added a 'Verified Buyers' testimonials section to build confidence after the promo-code story broke. It reads reassuring at a glance. It ships unless you block it.",
  artifactLabel: 'The section',
  lines: [],
  visualMockup: 'design_hard',
  checklistPrompt: "What's wrong with this section? Select everything you'd raise before it ships.",
  checklistOptions: [
    {
      id: 'design_hard_identical_avatars',
      label: "All three testimonials use the exact same avatar color and initials ('JM'), despite being attributed to three different named reviewers",
      isDefect: true,
      isHerring: false,
      mechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    },
    {
      id: 'design_hard_similar_quotes',
      label: 'All three quotes sound similar in tone and length',
      isDefect: false,
      isHerring: true,
      mechanism: 'STYLE_CLUTTER',
    },
    {
      id: 'design_hard_no_full_name',
      label: "The reviewer names aren't shown in full",
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'design_hard_no_verified_label',
      label: "None of the cards actually say 'Verified Buyer'",
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
    {
      id: 'design_hard_carousel',
      label: 'The testimonials are shown as a horizontal carousel instead of a list',
      isDefect: false,
      isHerring: false,
      mechanism: 'STYLE_CLUTTER',
    },
    {
      id: 'design_hard_nothing_wrong',
      label: 'Nothing here needs to change — this is safe to ship as-is',
      isDefect: false,
      isHerring: false,
      mechanism: 'LOGIC_EDGE_CASE_ERROR',
    },
  ],
  fixExplanation:
    "Every 'Verified Buyer' card uses the identical avatar — same color, same initials 'JM' — even though the names attached (Jordan M., Priya S., Marcus T.) are three different people. Two of the three initials don't even match their own name. This isn't a subtle placeholder-art choice; it's the visual signature of fabricated or copy-pasted testimonials, and it's exactly the kind of detail a customer, a journalist, or a regulator would notice immediately and use to call the whole trust section fake — on the one page built specifically to rebuild trust after the promo-code story. The fix is real, distinct avatars, or no avatars at all — never the same one reused across different identities.",
  herringExplanation:
    "Three short, similarly upbeat quotes is a real but minor writing-variety issue — testimonials often do sound alike, and it doesn't undermine trust on its own. Flagging tone instead of the reused avatar — the actual authenticity red flag — is the calibration failure being measured here.",
}

export const CRUCIBLE_QA_EASY: Record<CrucibleVariantKey, CrucibleVariantContent> = {
  CODE: CODE_EASY,
  MARKETING: MARKETING_EASY,
  DATA: DATA_EASY,
  DESIGN: DESIGN_EASY,
  BUSINESS: BUSINESS_EASY,
}

export const CRUCIBLE_QA_HARD: Record<CrucibleVariantKey, CrucibleVariantContent> = {
  CODE: CODE_HARD,
  MARKETING: MARKETING_HARD,
  DATA: DATA_HARD,
  DESIGN: DESIGN_HARD,
  BUSINESS: BUSINESS_HARD,
}

// Single lookup for QA content — every variant now has genuinely distinct
// content at every tier (previously only MEDIUM was discipline-specific;
// EASY/HARD were one shared CODE-flavored scenario regardless of which
// discipline a candidate was routed into — see git history).
export function getQaContent(variant: CrucibleVariantKey, tier: CrucibleTierKey): CrucibleVariantContent {
  if (tier === 'EASY') return CRUCIBLE_QA_EASY[variant]
  if (tier === 'HARD') return CRUCIBLE_QA_HARD[variant]
  return CRUCIBLE_VARIANTS[variant]
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

export const CRUCIBLE_PROMPT_TASK: Record<CrucibleTierKey, CruciblePromptTaskContent> = {
  EASY: {
    pageTitle: 'Stubs Crew Scheduler — Weekly Shift Builder',
    pageSections: [
      { kind: 'heading', text: 'Weekly Shift Builder — Week of 08/24' },
      { kind: 'note', text: 'Venue: Riverside Amphitheater — a single dropdown pinned above the grid; changing it reloads the whole page' },
      { kind: 'field', text: 'Employee: [Dropdown, 40+ names, sorted alphabetically by first name, no search]' },
      { kind: 'field', text: 'Shift Date: [Raw date picker, shows "2026-08-24", no day-of-week label]' },
      { kind: 'field', text: 'Start Time: [______]   End Time: [______]  (plain text, no format hint — accepts "4", "4pm", or "16:00")' },
      { kind: 'field', text: 'Role: [Dropdown: Box Office, Usher, Security, Merch]' },
      { kind: 'button', text: 'Add Shift — appends a row to the grid below; grid shows no highlighting when two shifts for the same employee overlap' },
      { kind: 'button', text: 'Save Schedule — no spinner, no confirmation message, no error if the save silently fails' },
    ],
    instructions:
      "This is Stubs' internal Crew Scheduler — the tool venue ops managers use to build weekly shift schedules for box-office, ushering, security, and merch staff. No customer will ever see it, but it has real friction points. Write the prompt you'd give an AI to meaningfully review and improve this page — not \"make this look nicer.\"",
    gradingRubric:
      "A strong prompt flags that the schedule grid never warns when the same employee is double-booked across overlapping shifts — the single most consequential gap, since it produces a real staffing failure on event day. It also notes the Start/End Time fields accept free text with no format validation, and that \"Save Schedule\" gives no feedback at all (no loading state, no confirmation, no error), leaving a manager unsure whether their changes saved. It gives the AI enough context (an internal ops tool, used under time pressure) to prioritize fixes rather than list everything wrong. A weak prompt asks generically to \"improve the UI/UX,\" fixates only on cosmetics, or asks for a full redesign with no reference to the actual fields or behaviors on the page.",
  },
  MEDIUM: {
    pageTitle: 'Stubs — Checkout',
    pageSections: [
      { kind: 'heading', text: 'Stubs Checkout' },
      { kind: 'note', text: 'Event: MIDNIGHT DROP — 2 tickets, General Admission' },
      { kind: 'field', text: 'Promo code: [__________]  [Apply]' },
      { kind: 'field', text: 'Card number: [__________]   Expiry: [____]   CVC: [___]' },
      { kind: 'note', text: 'Total: $148.00' },
      { kind: 'button', text: 'Pay Now' },
      { kind: 'note', text: 'Error state (shown when something fails): "Something went wrong. Please try again."' },
    ],
    instructions:
      "This is a real Stubs checkout page. It works, but it's not good. Write the prompt you'd give an AI to analyze this page and propose specific, concrete improvements — not \"make it better.\" A prompt precise enough that the AI's output would actually be useful to a real product team.",
    gradingRubric:
      'A strong prompt names concrete problems actually visible on this page — no itemized price breakdown before payment (just a flat "$148.00" with no ticket price / fees / discount split), no visible trust or security signals near the card fields, an error message that gives no actionable information ("Something went wrong"), and no confirmation of whether a promo code was actually applied before charging the card — and asks for a structured, actionable output (e.g. a prioritized list of fixes, specific before/after copy, or a redesigned field layout) rather than a vague "improve the UX" ask. A weak prompt is generic, never references anything specific to this page, or just asks the AI to "make it better" / "improve conversion" with no direction on what to look for or what output it wants back.',
  },
  HARD: {
    pageTitle: 'Trust & Safety at Stubs (public, rewriting post-incident)',
    pageSections: [
      { kind: 'heading', text: 'Trust & Safety at Stubs' },
      { kind: 'note', text: 'Context: a local news segment ran last night on bots buying up an entire first-day allocation for a sold-out show, which immediately resurfaced on secondary markets at 4x face value. Legal and Comms want this page rewritten and live by end of day.' },
      { kind: 'note', text: '"We take ticket fraud and unfair purchasing seriously, and we\'re constantly working to improve." — unchanged AI filler from the overnight draft' },
      { kind: 'note', text: '"Our systems automatically detect and block suspicious purchasing patterns before they reach checkout." — a specific, unverifiable claim, drafted with no input from Engineering on whether it\'s actually true' },
      { kind: 'note', text: 'FAQ: "Why did I see tickets on other sites at a higher price?" — answered vaguely, with no reference to the actual story and no explanation of what a customer should do' },
      { kind: 'note', text: 'Purchase limits: 4 tickets per account per show. Stated flatly, with no explanation of how or whether it\'s enforced.' },
      { kind: 'field', text: 'Report a Concern: [generic textbox], buried at the bottom of the page' },
    ],
    instructions:
      "Stubs' public Trust & Safety page is mid-rewrite, the day after a local news story about scalping bots. This page will be read by customers, by reporters, and by Stubs' own legal team — possibly in that order. Write the prompt you'd give an AI to improve it into language Stubs can actually stand behind.",
    gradingRubric:
      'A strong prompt explicitly flags the unverifiable "automatically detect and block" claim as a legal exposure — a specific, falsifiable promise Stubs may not be able to back up — and asks for it to be softened without stripping out all substance. It asks the AI to address the actual incident directly rather than staying generic (silence reads as evasive mid-news-cycle), while explicitly instructing it not to admit fault or concede a systemic failure. It calls for concrete, actionable information (how purchase limits are enforced, what a customer should do if they suspect a bot got tickets) over vague reassurance, and treats this as a legal-and-PR-sensitive document that needs to survive a legal review, not just a copyedit. A weak prompt asks generically to "sound more trustworthy," which risks overpromising even harder, or ignores the specific incident and the unverifiable claim entirely.',
  },
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

export const CRUCIBLE_DATASET_TASK: Record<CrucibleTierKey, CrucibleDatasetTaskContent> = {
  EASY: {
    businessContext:
      "Stubs' office snack budget has been a flat $400/month since 2019, and someone in #general is annoyed the good granola bars keep running out before Thursday. The office manager wants to know: should the budget go up, or is this just people eating more because the office is bigger now? Nobody's job depends on getting this one right — it's still worth doing right, because \"we panic-adjusted the snack budget based on vibes\" is not a sentence anyone wants to say out loud.",
    datasetDescription: 'Monthly snack spend and headcount for the last five months, plus spend per head.',
    columns: ['Month', 'Headcount', 'Snack spend', 'Spend per head'],
    rows: [
      ['March', 18, '$412', '$22.89'],
      ['April', 19, '$430', '$22.63'],
      ['May', 21, '$468', '$22.29'],
      ['June', 24, '$532', '$22.17'],
      ['July', 26, '$572', '$22.00'],
    ],
    instructions:
      "Should the snack budget go up? Write a recommendation the office manager could paste into a Slack reply — a few sentences, not a memo.",
    gradingRubric:
      "A strong answer notices total spend rose (~39%) but spend per head stayed essentially flat (~$22.00–$22.89) across all five months — the entire increase is explained by headcount growth, not overspending or richer snacks. It recommends against treating this as a waste problem, and the sharpest answer flags that the real mismatch is the flat $400/month cap itself, which spend has already exceeded for five straight months and will keep exceeding as headcount grows — proposing a per-head budget formula instead of a fixed number. A weak answer reacts to the rising total-spend column alone, without normalizing for headcount, and recommends cutting back or \"monitoring more closely.\"",
  },
  MEDIUM: {
    businessContext:
      "Stubs launched promo codes two weeks ago (the same feature from the engineering challenge). Support ticket volume is up sharply since, and the team is burning out. The Head of Support wants Engineering to freeze all new feature work until things calm down. Engineering says the data doesn't support a freeze. You've been asked to look at the numbers and make the call.",
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
  },
  HARD: {
    businessContext:
      "Grayport just passed a ticket-fee-disclosure and anti-scalping law — every point of sale now has to show an itemized fee breakdown and resale price history for every ticket, with fines up to $50,000 per violation for non-compliance. Legal estimates it'll cost roughly $650K a year to build and maintain compliant infrastructure for Grayport alone. The exec team has to decide: eat the compliance cost and stay, or pull out of Grayport entirely. On a straight revenue view, Grayport looks like an easy market to walk away from — it's one of Stubs' smallest. This is exactly the kind of decision that's gone wrong for Stubs before — 2008, the 2010–12 pivot, 2020 all turned on someone reading a fast-moving situation correctly. Get this one wrong and it's a real candidate for the fourth.",
    datasetDescription:
      'Annual figures for the five markets under review. "Referral-attributed revenue" is ticket revenue in OTHER Stubs cities generated by users who signed up via a referral or promo code traced back to a Grayport account — Grayport has an outsized number of college-town tastemakers whose friends and followers sign up for Stubs elsewhere.',
    columns: ['City', 'Direct ticket revenue', '% of total company revenue', 'Referral-attributed revenue (other cities)', 'Total attributable revenue', 'New compliance cost (annual)'],
    rows: [
      ['Denton', '$4.2M', '19%', '$0.3M', '$4.5M', '—'],
      ['Grayport', '$1.1M', '3%', '$2.8M', '$3.9M', '~$650K'],
      ['Millhaven', '$6.7M', '22%', '$0.5M', '$7.2M', '—'],
      ['Port Calder', '$3.9M', '13%', '$0.4M', '$4.3M', '—'],
      ['Eastbrook', '$5.0M', '17%', '$0.6M', '$5.6M', '—'],
    ],
    instructions:
      "Should Stubs exit Grayport, or invest in compliance and stay? Write a recommendation a VP would actually read before a Monday decision meeting — a few sentences, with your reasoning.",
    gradingRubric:
      "A strong analysis notices Grayport looks like an obvious cut on direct revenue alone (3% of total, smallest of the five markets) — but doesn't stop there. It catches that Grayport's referral-attributed revenue ($2.8M) is over 2.5x its own direct revenue, an unusually large halo effect compared to every other city in the table. It compares the new compliance cost ($650K/year) against Grayport's TOTAL attributable revenue ($3.9M), not just direct revenue ($1.1M) — recognizing that exiting doesn't just forfeit $1.1M, it puts the $2.8M in other-city revenue at risk too. It recommends staying and absorbing the compliance cost, while flagging the real uncertainty (is the referral effect actually causal, or would it persist anyway?) rather than treating the number as ironclad. A weak analysis recommends exiting based on Grayport's small direct-revenue share alone, never engaging with the referral column, or engages with it only as a footnote that doesn't change the recommendation.",
  },
}

// ── Read-the-Results activity (universal, single scenario — no difficulty
// ladder yet, unlike the other three activities). A test already ran and
// the result looks clean; the candidate has to decide whether to trust it.
// Reuses CrucibleDatasetTaskContent's shape since the content is
// structurally identical (context + a small table + a decision) — the
// difference is entirely in what the data represents: an open diagnostic
// question there, a test result with a specific methodological trap here.
export const CRUCIBLE_RESULTS_TASK: CrucibleDatasetTaskContent = {
  businessContext:
    "Stubs ran a 3-week test of a new \"Join Waitlist\" feature — when a show sells out, instead of just showing \"Sold Out,\" fans can join a waitlist and get auto-charged if a ticket frees up. The team only turned it on in 4 cities, chosen because those cities' Ops leads volunteered to help monitor the rollout closely. The results came back clean: those 4 cities saw 34% more post-sellout revenue than the rest of the company during the same window. Product wants to ship it everywhere by next week. You've been asked to sanity-check the result first.",
  datasetDescription: 'Post-sellout revenue and pre-existing resale activity, waitlist cities vs. the rest of the company, same 3-week window.',
  columns: ['Group', 'Avg. post-sellout revenue / show', 'Shows in window', 'Historical resale/scalping rate (before the test)'],
  rows: [
    ['Waitlist cities (4)', '$2,140', '26', '41%'],
    ['Rest of company (12 cities)', '$1,596', '89', '18%'],
  ],
  instructions:
    "Should Stubs roll the waitlist feature out to every city next week based on this result? Write your recommendation — be specific about what the data does and doesn't support.",
  gradingRubric:
    "A strong analysis notices the 4 waitlist cities weren't randomly assigned — they were chosen because their Ops leads volunteered — and that those same 4 cities already had a much higher historical resale/scalping rate (41% vs. 18%) BEFORE the test even started. That pre-existing difference means the 34% revenue lift is confounded: cities with more scalping activity naturally have more demand-after-sellout regardless of a waitlist feature, so some or all of the observed lift may be explained by which cities were picked, not by the feature itself. A strong recommendation doesn't say \"ship it everywhere\" based on this result alone — it calls for a properly randomized follow-up test across a representative mix of cities, or at minimum a phased rollout that compares each city to its OWN historical baseline rather than to other cities. A weak analysis takes the 34% lift at face value and recommends immediate company-wide rollout without asking why those 4 cities were chosen or noticing the resale-rate gap.",
}
