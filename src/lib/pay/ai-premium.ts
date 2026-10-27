// The AI-skill pay premium as the salary pages, the explainer and the pay check show it. Pure and client-safe; tested in
// src/test/ai-premium.test.ts. Everything comes from the AI market snapshot (src/lib/skills/ai-market-live.ts), whose method is
// in src/lib/skills/ai-market.ts and docs/PATTERN_PAY_AND_AI.md: posted pay only, jobs read from a full description,
// "AI" = names a specific AI skill, baseline = no AI mention at all, nothing from fewer than 30 paid postings on either side.
//
// The premium is a difference in ADVERTISED pay between postings. It is not what anyone is paid and it is not a claim that
// learning a skill causes a raise, and every sentence here says "listings", never "people".

import { CRAWLER_FUNCTION_LABEL } from '@/lib/jobs/job-functions'
import { MIN_PER_SIDE, type AiMarketData } from '@/lib/skills/ai-market'

/** A title needs this many listings tagged with a function, and this share of them in one function, to be placed in it. */
export const TITLE_FN_MIN_TAGGED = 10
export const TITLE_FN_MIN_SHARE = 0.6

/** The function most of a title's listings are tagged with, or null when there are too few tagged or no clear majority. */
export function modalFunction(fns: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>()
  let tagged = 0
  for (const f of fns) {
    if (!f) continue
    tagged++
    counts.set(f, (counts.get(f) ?? 0) + 1)
  }
  if (tagged < TITLE_FN_MIN_TAGGED) return null
  let best: string | null = null
  let bestN = 0
  for (const [f, n] of counts) if (n > bestN) { best = f; bestN = n }
  return best !== null && bestN / tagged >= TITLE_FN_MIN_SHARE ? best : null
}

export interface FunctionAiPremium {
  fn: string
  label: string
  asOf: string
  /** Live postings in the function read from a full description (the share's denominator). */
  postings: number
  sharePct: number
  nAi: number
  nBase: number
  medAi: number
  medBase: number
  rawPct: number
  rawUsd: number
  /** Like for like (same function, level and industry); absent when the cells are too thin. */
  likePct?: number
  likeUsd?: number
  likeN?: number
}

const CODE_OF_LABEL = new Map(Object.entries(CRAWLER_FUNCTION_LABEL).map(([code, label]) => [label.toLowerCase(), code]))

/** A listing's targetFunction holds the stored label ("Human Resources"); the snapshot is keyed by crawler code ("people"). Accepts either. */
export function functionCode(fn: string | null | undefined): string | null {
  if (!fn) return null
  const t = fn.trim()
  if (CRAWLER_FUNCTION_LABEL[t]) return t
  return CODE_OF_LABEL.get(t.toLowerCase()) ?? null
}

/** The function's premium, or null when the snapshot has none or either side has fewer than 30 paid postings. */
export function aiPremiumForFunction(live: AiMarketData | null, fn: string | null | undefined): FunctionAiPremium | null {
  const code = functionCode(fn)
  if (!live || !code) return null
  const f = live.functions[code]
  const p = f?.premium
  if (!f || !p || p.nAi < MIN_PER_SIDE || p.nBase < MIN_PER_SIDE || p.medBase <= 0) return null
  return {
    fn: code,
    label: f.label,
    asOf: live.asOf,
    postings: f.n,
    sharePct: f.sharePct,
    nAi: p.nAi,
    nBase: p.nBase,
    medAi: p.medAi,
    medBase: p.medBase,
    rawPct: p.rawPct,
    rawUsd: p.rawUsd,
    ...(p.likePct !== undefined && p.likeUsd !== undefined ? { likePct: p.likePct, likeUsd: p.likeUsd, likeN: p.likeN } : {}),
  }
}

/** "+18%", "-1%", "0%". */
export const signedPct = (n: number): string => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n)}%`

const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`
const k = (n: number): string => `$${Math.round(Math.abs(n) / 100) / 10}k`

/** The one-line method that goes next to every premium. */
export const PREMIUM_METHOD =
  'Advertised pay only: the midpoint of the range an employer posted, on live U.S. postings read from the full text. “Asks for an AI skill” means the posting names a specific AI skill; “no AI” means it never mentions AI.'

/** The headline sentence for a function, without any promise about what a person will be paid. */
export function aiPremiumSentence(p: FunctionAiPremium): string {
  const lead =
    p.likePct !== undefined && p.likeUsd !== undefined
      ? `Among ${p.label} listings, those that ask for an AI skill advertise ${signedPct(p.likePct)} (about ${p.likeUsd < 0 ? '-' : ''}${k(p.likeUsd)}) compared with similar listings that do not, matched on level and industry.`
      : `Among ${p.label} listings, those that ask for an AI skill advertise a median ${usd(p.medAi)}, against ${usd(p.medBase)} for those that never mention AI (${signedPct(p.rawPct)}). That raw gap is not matched on level or industry.`
  return lead
}

export interface TitleRange {
  p25: number
  median: number
  p75: number
}

export interface AiIllustration {
  /** The title's median listed pay, moved by the function's like-for-like premium. */
  medianWithAi: number
  pct: number
}

/**
 * An illustration for the pay check: the title's median listed pay moved by the function's like-for-like premium, rounded to
 * $500. Only when a like-for-like premium exists; the raw gap mixes in level and employer size and is not applied to a title.
 */
export function aiIllustration(range: TitleRange, premium: FunctionAiPremium | null): AiIllustration | null {
  if (!premium || premium.likePct === undefined || range.median <= 0) return null
  return { medianWithAi: Math.round((range.median * (1 + premium.likePct / 100)) / 500) * 500, pct: premium.likePct }
}

// ---- CSV ------------------------------------------------------------------------------------------------------------

const csvCell = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const CSV_COLUMNS = [
  'function',
  'postings_read_from_full_text',
  'share_asking_for_an_ai_skill_pct',
  'paid_postings_asking_for_an_ai_skill',
  'paid_postings_with_no_ai_mention',
  'median_advertised_pay_ai_usd',
  'median_advertised_pay_no_ai_usd',
  'raw_premium_pct',
  'like_for_like_premium_pct',
  'like_for_like_ai_postings',
  'as_of',
] as const

/**
 * The aggregate table behind the explainer, one row per function that has a premium from 30+ paid postings on both sides.
 * Aggregates only: no posting, employer or person is in it.
 */
export function aiPremiumCsv(live: AiMarketData): string {
  const asOf = live.asOf.slice(0, 10)
  const rows = Object.keys(live.functions)
    .map((fn) => aiPremiumForFunction(live, fn))
    .filter((p): p is FunctionAiPremium => p !== null)
    .sort((a, b) => a.label.localeCompare(b.label))
  const lines = [CSV_COLUMNS.join(',')]
  for (const p of rows) {
    lines.push(
      [p.label, p.postings, p.sharePct, p.nAi, p.nBase, Math.round(p.medAi), Math.round(p.medBase), p.rawPct, p.likePct ?? '', p.likeN ?? '', asOf].map(csvCell).join(','),
    )
  }
  return `${lines.join('\n')}\n`
}
