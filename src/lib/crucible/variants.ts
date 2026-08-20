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

export interface CrucibleVariantAnswerKey {
  defectZoneLines: number[]
  defectMechanism: CrucibleMechanism
  // Fallback-only fuzzy keyword class — used solely for the near-miss (+45)
  // credit when the mechanism pick is wrong but the note text still
  // demonstrates real understanding. Never the primary scoring path.
  defectKeywords: string[]
  herringLine: number
  herringMechanism: CrucibleMechanism
}

export interface CrucibleVariantContent {
  key: CrucibleVariantKey
  label: string
  scenarioTitle: string
  brief: string
  artifactLabel: string
  lines: CrucibleArtifactLine[]
  worstThingPrompt: string
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

export const CRUCIBLE_ANSWER_KEYS: Record<CrucibleVariantKey, CrucibleVariantAnswerKey> = {
  CODE: {
    defectZoneLines: [21, 22, 23, 24, 25, 26],
    defectMechanism: 'DATA_LOST_WRONG_NEVER_SAVED',
    defectKeywords: ['persist', 'save', 'reuse', 'unlimited', 'infinite', 'never saved', "doesn't save", 'not saved', 'promos.save', 'db write', 'in-memory'],
    herringLine: 8,
    herringMechanism: 'STYLE_CLUTTER',
  },
  MARKETING: {
    defectZoneLines: [11],
    defectMechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    defectKeywords: ['fabricat', 'false', 'never reviewed', "can't verify", 'cannot verify', 'hallucinat', 'made up', 'not true', 'unverified', 'no source', 'lawsuit', 'ftc'],
    herringLine: 1,
    herringMechanism: 'STYLE_CLUTTER',
  },
  DATA: {
    defectZoneLines: [7, 8, 9, 18, 19],
    defectMechanism: 'CLAIM_FALSE_UNVERIFIABLE',
    defectKeywords: ['10%', '10.5%', "doesn't match", 'does not match', 'solstice', 'seasonal', 'confound', 'overstat', 'math', 'table shows', 'contradicts', '40%'],
    herringLine: 21,
    herringMechanism: 'STYLE_CLUTTER',
  },
}

export const CRUCIBLE_VARIANTS: Record<CrucibleVariantKey, CrucibleVariantContent> = {
  CODE: {
    key: 'CODE',
    label: 'Engineering',
    scenarioTitle: 'DoorList — Add promo code support to checkout',
    brief:
      'DoorList, a ticketing app. An AI agent opened a PR: "Add promo code support to checkout." The diff looks done. Visible tests pass — the happy path and the invalid-code path. It ships tonight unless you block it.',
    artifactLabel: 'The diff',
    lines: CODE_LINES,
    worstThingPrompt: "What's the worst thing in this PR?",
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
    worstThingPrompt: "What's the worst thing in this email?",
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
    worstThingPrompt: "What's the worst thing in this memo?",
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
