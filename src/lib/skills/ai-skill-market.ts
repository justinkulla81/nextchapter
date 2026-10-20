// What the AI-skills analysis (2026-10-16) says about a function: how often its postings ask
// for a specific AI skill, the posted-pay premium (always raw AND like-for-like together), and
// which AI tools and skills its postings name most. Static numbers from the analysis
// (ai-skill-market.data.ts), so this costs nothing per view. Pure; tested in
// src/test/ai-skills.test.ts.

import { CRAWLER_FUNCTION_LABEL } from '@/lib/jobs/job-functions'
import { JOB_INDUSTRY_KEY_BUCKET } from '@/lib/profile/industry-reading'
import { AI_CELL_TOP, AI_FUNCTION_ITEMS, AI_FUNCTION_STATS, AI_FUNCTION_TOOLS, AI_MARKET_AS_OF, AI_SOC_STATS } from './ai-skill-market.data'
import { aiSkillItem, aiToolDisplayName } from './ai-skills'

export { AI_MARKET_AS_OF } from './ai-skill-market.data'

const LABEL_TO_CODE = new Map(Object.entries(CRAWLER_FUNCTION_LABEL).map(([code, label]) => [label.toLowerCase(), code]))
const BUCKET_TO_INDUSTRY = new Map(Object.entries(JOB_INDUSTRY_KEY_BUCKET).map(([key, bucket]) => [bucket.toLowerCase(), key]))

/** A function given as the crawler code ("data_ai") or its label ("Data & Analytics") → code. */
export function functionCode(fn: string | null | undefined): string | null {
  const f = (fn ?? '').trim().toLowerCase()
  if (!f) return null
  if (CRAWLER_FUNCTION_LABEL[f]) return f
  return LABEL_TO_CODE.get(f) ?? null
}

/** Industry buckets ("Financial Services & Banking") or crawler keys → crawler keys. */
export function industryKeys(industries: (string | null | undefined)[]): string[] {
  const out: string[] = []
  for (const raw of industries) {
    const i = (raw ?? '').trim().toLowerCase()
    const key = JOB_INDUSTRY_KEY_BUCKET[i] ? i : BUCKET_TO_INDUSTRY.get(i)
    if (key && !out.includes(key)) out.push(key)
  }
  return out
}

const k = (usd: number) => `$${(usd / 1000).toFixed(usd % 1000 === 0 ? 0 : 1)}k`
const AS_OF_TEXT = new Date(`${AI_MARKET_AS_OF}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export interface AiMarketLine {
  fn: string
  sharePct: number
  /** The one line to show. */
  text: string
  hasPremium: boolean
}

/**
 * "In Finance postings, 12% ask for a specific AI skill. Where they do, posted pay is $32.5k (26%)
 * higher raw, about 21% like-for-like (same level and industry). As of Oct 16, 2026."
 * The premium is shown only when both the raw and the like-for-like numbers exist — never one alone.
 */
export function aiMarketLine(fn: string | null | undefined): AiMarketLine | null {
  const code = functionCode(fn)
  const s = code ? AI_FUNCTION_STATS[code] : undefined
  if (!code || !s) return null
  const name = CRAWLER_FUNCTION_LABEL[code]
  const share = `In ${name} postings, ${Math.round(s.sharePct)}% ask for a specific AI skill.`
  const hasPremium = s.rawUsd !== undefined && s.rawPct !== undefined && s.likePct !== undefined && s.likeUsd !== undefined
  const premium = hasPremium
    ? s.rawUsd! > 0
      ? ` Where they do, posted pay is ${k(s.rawUsd!)} (${s.rawPct}%) higher raw, about ${s.likePct}% higher like-for-like (same level and industry).`
      : ` Where they do, posted pay is not higher (raw ${s.rawPct}%, like-for-like ${s.likePct}%).`
    : ' Too few postings with pay to compare like-for-like.'
  return { fn: code, sharePct: s.sharePct, hasPremium, text: `${share}${premium} As of ${AS_OF_TEXT}.` }
}

/**
 * The same line for a pivot target occupation (O*NET-SOC): the occupation's own share when 100+
 * postings carry it, with the premium of the function most of them sit in. Falls back to that
 * function's line; null when the occupation isn't in the analysis.
 */
export function aiMarketLineForOccupation(socCode: string | null | undefined, title?: string | null): AiMarketLine | null {
  const occ = socCode ? AI_SOC_STATS[socCode] : undefined
  if (!occ) return null
  const fnLine = aiMarketLine(occ.fn)
  const name = title?.trim() || occ.title
  const share = `In ${name} postings, ${Math.round(occ.sharePct)}% ask for a specific AI skill.`
  if (!fnLine) return { fn: occ.fn ?? '', sharePct: occ.sharePct, hasPremium: false, text: `${share} As of ${AS_OF_TEXT}.` }
  // Swap the function's share for the occupation's; keep the function's premium wording.
  const rest = fnLine.text.slice(fnLine.text.indexOf('.') + 1).trim()
  const fnName = CRAWLER_FUNCTION_LABEL[fnLine.fn]
  const premium = fnLine.hasPremium ? rest.replace(/^Where they do,/, `Across ${fnName} postings that ask,`) : `As of ${AS_OF_TEXT}.`
  return { fn: fnLine.fn, sharePct: occ.sharePct, hasPremium: fnLine.hasPremium, text: `${share} ${premium}` }
}

export const MAX_AI_TOOL_SUGGESTIONS = 8

/** The AI tools postings in this function (and industry, when the cell is big enough) name most, as members call them. */
export function suggestedAiTools(fn: string | null | undefined, industries: (string | null | undefined)[] = []): string[] {
  const code = functionCode(fn)
  if (!code) return []
  const out: string[] = []
  const add = (t: string) => {
    const name = aiToolDisplayName(t)
    if (!out.includes(name)) out.push(name)
  }
  for (const ind of industryKeys(industries)) for (const t of AI_CELL_TOP[`${code}|${ind}`]?.tools ?? []) add(t)
  for (const t of AI_FUNCTION_TOOLS[code] ?? []) add(t)
  return out.slice(0, MAX_AI_TOOL_SUGGESTIONS)
}

/** The AI skill items (ids) postings in this function / cell ask for most. */
export function suggestedAiItems(fn: string | null | undefined, industries: (string | null | undefined)[] = [], max = 4): string[] {
  const code = functionCode(fn)
  if (!code) return []
  const out: string[] = []
  for (const ind of industryKeys(industries)) for (const i of AI_CELL_TOP[`${code}|${ind}`]?.items ?? []) if (!out.includes(i)) out.push(i)
  for (const i of AI_FUNCTION_ITEMS[code] ?? []) if (!out.includes(i)) out.push(i)
  return out.filter((i) => aiSkillItem(i)).slice(0, max)
}
