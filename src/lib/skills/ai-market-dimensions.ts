// Industry, state and level breakdowns of the AI job market: share of postings asking for a specific
// AI skill, and the posted-pay premium (raw and like for like). Pure assembly; the SQL is in
// ai-market-dimensions-server.ts. Same rules as buildAiMarket: nothing from fewer than 30 paid
// postings per side, like for like only from cells with 30+ on both sides and 50+ AI postings.
// Tested in src/test/ai-market-dimensions.test.ts.

import { AI_LEVELS, AI_LEVEL_LABEL, likeForLike, premiumOf, type AiDimensionRow, type AiDimensions } from '@/lib/skills/ai-market'

export interface DimShareRow {
  k: string
  n: number
  skill: number
}
export interface DimCellRow {
  k: string
  fn: string | null
  lvl: string | null
  side: 'ai' | 'base'
  n: number
  med: number
  /** GROUPING(fn, lvl): 0 = a function x level cell inside the group, 3 = the whole group. */
  g: number
}

const round1 = (x: number) => Math.round(x * 10) / 10

export function buildDimension(shares: DimShareRow[], cells: DimCellRow[], label: (k: string) => string): AiDimensionRow[] {
  type Side = { n: number; med: number }
  const whole = new Map<string, { ai?: Side; base?: Side }>()
  const inner = new Map<string, Map<string, { ai?: Side; base?: Side }>>()
  for (const c of cells) {
    const side = { n: Number(c.n), med: Number(c.med) }
    if (Number(c.g) === 3) {
      const w = whole.get(c.k) ?? {}
      w[c.side] = side
      whole.set(c.k, w)
    } else if (c.fn && c.lvl) {
      const m = inner.get(c.k) ?? new Map()
      const key = `${c.fn}|${c.lvl}`
      const p = m.get(key) ?? {}
      p[c.side] = side
      m.set(key, p)
      inner.set(c.k, m)
    }
  }
  return shares
    .map((s) => {
      const n = Number(s.n)
      const skill = Number(s.skill)
      const w = whole.get(s.k)
      return {
        key: s.k,
        label: label(s.k),
        n,
        aiSkill: skill,
        sharePct: n ? round1((100 * skill) / n) : 0,
        premium: premiumOf(w?.ai, w?.base, likeForLike([...(inner.get(s.k)?.values() ?? [])])),
      }
    })
    .sort((a, b) => b.n - a.n)
}

export function buildAiDimensions(input: {
  industry: { shares: DimShareRow[]; cells: DimCellRow[] }
  state: { shares: DimShareRow[]; cells: DimCellRow[] }
  level: { shares: DimShareRow[]; cells: DimCellRow[] }
}): AiDimensions {
  const levelOrder = new Map<string, number>(AI_LEVELS.map((l, i) => [l, i]))
  return {
    industry: buildDimension(input.industry.shares, input.industry.cells, (k) => k),
    state: buildDimension(input.state.shares, input.state.cells, (k) => k),
    level: buildDimension(input.level.shares, input.level.cells, (k) => AI_LEVEL_LABEL[k as keyof typeof AI_LEVEL_LABEL] ?? k).sort(
      (a, b) => (levelOrder.get(a.key) ?? 99) - (levelOrder.get(b.key) ?? 99)
    ),
  }
}
