import type { CrucibleMechanism, CrucibleTierKey } from './scoring-types'

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
    label: 'Data & Analytics',
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

export const CRUCIBLE_QA_EASY: CrucibleVariantContent = {
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

export const CRUCIBLE_QA_HARD: CrucibleVariantContent = {
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

// Single lookup for QA content — MEDIUM stays discipline-routed (the
// job-intent fork), EASY/HARD are universal regardless of which discipline
// a candidate was routed into.
export function getQaContent(variant: CrucibleVariantKey, tier: CrucibleTierKey): CrucibleVariantContent {
  if (tier === 'EASY') return CRUCIBLE_QA_EASY
  if (tier === 'HARD') return CRUCIBLE_QA_HARD
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
