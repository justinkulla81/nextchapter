import type { EntryMarket } from '@/lib/jobs/entry-market'
// The AI job market snapshot (ai-market-live.ts computes it from the live board): pure assembly
// and the member-facing wording. Client-safe; tested in src/test/ai-market.test.ts.
//
// Method (the 2026-10-16 analysis, findings.md "Pay"): posted pay only (the annualized midpoint
// of a range the employer posted; board-listed and estimated pay left out), on jobs whose AI
// fields were read from a full description (aiBasis full | twin). "AI" = asks for a specific AI
// skill; the baseline = no AI mention anywhere in the text. Raw = median vs median. Like-for-like
// = within cells of the same function x level x industry with 30+ paid postings on BOTH sides,
// the median log-ratio weighted by the AI side's n (dollars: the matching weighted difference).
// Nothing is shown from fewer than 30 per side; like-for-like needs 50+ AI postings in cells.

import { aiSkillItem, aiToolDisplayName } from './ai-skills'

export const MIN_PER_SIDE = 30
export const MIN_LIKE_N = 50

export const AI_LEVELS = ['entry', 'early', 'mid', 'senior', 'manager', 'director', 'vp'] as const
export type AiLevel = (typeof AI_LEVELS)[number]
export const AI_LEVEL_LABEL: Record<AiLevel, string> = {
  entry: 'Entry',
  early: 'Early career',
  mid: 'Mid-level',
  senior: 'Senior IC',
  manager: 'Manager',
  director: 'Director',
  vp: 'VP and above',
}

export interface AiMarketShareRow {
  fn: string
  n: number
  skill: number
  exposed: number
}
export interface AiMarketCellRow {
  fn: string | null
  lvl: string | null
  ind: string | null
  side: 'ai' | 'base'
  n: number
  med: number
  /** GROUPING(fn, lvl, ind): 0 = full cell, 1 = fn x lvl, 3 = fn, 7 = all. */
  g: number
}
export interface AiMarketTopRow {
  fn: string
  key: string
  n: number
}

export interface AiPremium {
  nAi: number
  nBase: number
  medAi: number
  medBase: number
  rawUsd: number
  rawPct: number
  /** Like-for-like; absent when the cells hold fewer than MIN_LIKE_N AI postings. */
  likeUsd?: number
  likePct?: number
  likeN?: number
  likeCells?: number
}

export interface AiFunctionMarket {
  label: string
  /** Live jobs in the function with a full text (the share's denominator). */
  n: number
  aiSkill: number
  aiExposed: number
  sharePct: number
  exposedPct: number
  premium?: AiPremium
  levels: Partial<Record<AiLevel, AiPremium>>
  topItems: { id: string; n: number }[]
  topTools: { name: string; n: number }[]
}

/** One row of a breakdown: an industry, a state or a level. */
export interface AiDimensionRow {
  key: string
  label: string
  /** Live full-text postings in the group (the share's denominator). */
  n: number
  aiSkill: number
  sharePct: number
  premium?: AiPremium
}

export interface AiDimensions {
  industry: AiDimensionRow[]
  state: AiDimensionRow[]
  level: AiDimensionRow[]
}

export interface AiMarketData {
  asOf: string
  /** Breakdowns across all functions; absent in snapshots stored before they were added. */
  dimensions?: AiDimensions
  counts: {
    live: number
    aiSkill: number
    aiExposed: number
    fullText: number
    twin: number
    excerpt: number
    unread: number
    aiSkillFullText: number
    aiExposedFullText: number
  }
  overall?: AiPremium
  /** Keyed by crawler function code (data_ai, finance, …). */
  functions: Record<string, AiFunctionMarket>
  /** Entry-level numbers (src/lib/jobs/entry-market.ts); absent in snapshots stored before 2026-10-23. */
  entry?: EntryMarket
}

const round1 = (x: number) => Math.round(x * 10) / 10
const r500 = (x: number) => Math.round(x / 500) * 500

/** Like-for-like over cells (each with both sides ≥ MIN_PER_SIDE). */
export function likeForLike(cells: { ai?: { n: number; med: number }; base?: { n: number; med: number } }[]) {
  let num = 0
  let numUsd = 0
  let den = 0
  let used = 0
  for (const c of cells) {
    if (!c.ai || !c.base || c.ai.n < MIN_PER_SIDE || c.base.n < MIN_PER_SIDE || c.ai.med <= 0 || c.base.med <= 0) continue
    const w = c.ai.n
    num += w * Math.log(c.ai.med / c.base.med)
    numUsd += w * (c.ai.med - c.base.med)
    den += w
    used += 1
  }
  if (den < MIN_LIKE_N) return null
  return { likePct: round1(100 * (Math.exp(num / den) - 1)), likeUsd: r500(numUsd / den), likeN: den, likeCells: used }
}

export function premiumOf(ai: { n: number; med: number } | undefined, base: { n: number; med: number } | undefined, like: ReturnType<typeof likeForLike>): AiPremium | undefined {
  if (!ai || !base || ai.n < MIN_PER_SIDE || base.n < MIN_PER_SIDE || base.med <= 0) return undefined
  return {
    nAi: ai.n,
    nBase: base.n,
    medAi: r500(ai.med),
    medBase: r500(base.med),
    rawUsd: r500(ai.med - base.med),
    rawPct: round1(100 * (ai.med / base.med - 1)),
    ...(like ?? {}),
  }
}

export function buildAiMarket(input: {
  asOf: string
  counts: AiMarketData['counts']
  shares: AiMarketShareRow[]
  cells: AiMarketCellRow[]
  items: AiMarketTopRow[]
  tools: AiMarketTopRow[]
  functionLabels: Record<string, string>
}): AiMarketData {
  const codeOf = new Map(Object.entries(input.functionLabels).map(([code, label]) => [label.toLowerCase(), code]))
  const code = (fn: string | null) => (fn ? (input.functionLabels[fn] ? fn : codeOf.get(fn.toLowerCase()) ?? null) : null)

  type Side = { n: number; med: number }
  type Pair = { ai?: Side; base?: Side }
  const full = new Map<string, Pair>() // fn|lvl|ind
  const byFnLvl = new Map<string, Pair>()
  const byFn = new Map<string, Pair>()
  const all: Pair = {}
  const put = (m: Map<string, Pair>, k: string, r: AiMarketCellRow) => {
    const p = m.get(k) ?? {}
    p[r.side] = { n: Number(r.n), med: Number(r.med) }
    m.set(k, p)
  }
  for (const r of input.cells) {
    const g = Number(r.g)
    if (g === 7) all[r.side] = { n: Number(r.n), med: Number(r.med) }
    const c = code(r.fn)
    if (!c && g !== 7) continue
    if (g === 0) put(full, `${c}|${r.lvl}|${r.ind}`, r)
    else if (g === 1) put(byFnLvl, `${c}|${r.lvl}`, r)
    else if (g === 3) put(byFn, `${c}`, r)
  }
  const cellsWhere = (pred: (fn: string, lvl: string) => boolean) =>
    [...full.entries()].filter(([k]) => {
      const [fn, lvl] = k.split('|')
      return pred(fn, lvl)
    }).map(([, v]) => v)

  const functions: Record<string, AiFunctionMarket> = {}
  for (const s of input.shares) {
    const c = code(s.fn)
    if (!c) continue
    const prev = functions[c]
    const n = (prev?.n ?? 0) + Number(s.n)
    const skill = (prev?.aiSkill ?? 0) + Number(s.skill)
    const exposed = (prev?.aiExposed ?? 0) + Number(s.exposed)
    functions[c] = {
      label: input.functionLabels[c],
      n,
      aiSkill: skill,
      aiExposed: exposed,
      sharePct: n ? round1((100 * skill) / n) : 0,
      exposedPct: n ? round1((100 * exposed) / n) : 0,
      levels: {},
      topItems: [],
      topTools: [],
    }
  }
  for (const [c, f] of Object.entries(functions)) {
    const p = byFn.get(c)
    f.premium = premiumOf(p?.ai, p?.base, likeForLike(cellsWhere((fn) => fn === c)))
    for (const lvl of AI_LEVELS) {
      const q = byFnLvl.get(`${c}|${lvl}`)
      const prem = premiumOf(q?.ai, q?.base, likeForLike(cellsWhere((fn, l) => fn === c && l === lvl)))
      if (prem) f.levels[lvl] = prem
    }
  }
  const top = (rows: AiMarketTopRow[], keep: (k: string) => boolean) => {
    const by = new Map<string, Map<string, number>>()
    for (const r of rows) {
      const c = code(r.fn)
      if (!c || !keep(r.key)) continue
      const m = by.get(c) ?? new Map<string, number>()
      m.set(r.key, (m.get(r.key) ?? 0) + Number(r.n))
      by.set(c, m)
    }
    return by
  }
  for (const [c, m] of top(input.items, (k) => !!aiSkillItem(k))) {
    if (functions[c]) functions[c].topItems = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ id, n }))
  }
  for (const [c, m] of top(input.tools, () => true)) {
    if (functions[c]) functions[c].topTools = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, n]) => ({ name: aiToolDisplayName(name), n }))
  }
  return {
    asOf: input.asOf,
    counts: input.counts,
    overall: premiumOf(all.ai, all.base, likeForLike([...full.values()])),
    functions,
  }
}

// ── wording ──

const k = (usd: number) => `$${(Math.abs(usd) / 1000).toFixed(Math.abs(usd) % 1000 === 0 ? 0 : 1)}k`

export function asOfText(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })
}

/**
 * "posted pay is $32.5k (26%) higher raw, about 21% higher like-for-like (same level and industry)".
 * Null unless both the raw and the like-for-like numbers exist — never one without the other.
 */
export function premiumPhrase(p: AiPremium | undefined, controls = 'same level and industry'): string | null {
  if (!p || p.likePct === undefined || p.likeUsd === undefined) return null
  if (p.rawUsd <= 0 && p.likePct <= 0) return `posted pay is not higher (raw ${p.rawPct}%, like-for-like ${p.likePct}%)`
  const like = p.likePct > 0 ? `about ${p.likePct}% higher like-for-like (${controls})` : `about the same like-for-like (${controls}: ${p.likePct}%)`
  return `posted pay is ${k(p.rawUsd)} (${p.rawPct}%) ${p.rawUsd >= 0 ? 'higher' : 'lower'} raw, ${like}`
}

/** Does the like-for-like comparison show AI postings paying more? */
export function paysMore(p: AiPremium | undefined): boolean {
  return !!p && p.likePct !== undefined && p.likePct > 0 && p.rawUsd > 0
}
