// What the public /ai-skills page shows, built from the static analysis (ai-skill-market.data.ts).
// Pure and client-safe; tested in src/test/ai-skills-public.test.ts. A premium is shown only
// when both the raw and the like-for-like numbers exist, never one alone (same rule as aiMarketLine).

import { CRAWLER_FUNCTION_LABEL } from '@/lib/jobs/job-functions'
import { AI_FUNCTION_STATS, type AiFunctionStat } from '@/lib/skills/ai-skill-market.data'
import { AI_SKILL_GROUPS, AI_SKILL_ITEMS } from '@/lib/skills/ai-skills'
import { AI_LEVELS, AI_LEVEL_LABEL, type AiDimensionRow, type AiMarketData, type AiPremium } from '@/lib/skills/ai-market'

export interface PublicFunctionRow {
  fn: string
  label: string
  postings: number
  sharePct: number
  /** null when either side was too thin to compare. */
  rawPremiumPct: number | null
  likePremiumPct: number | null
  likePremiumUsd: number | null
}

const hasPremium = (s: AiFunctionStat) => s.rawPct !== undefined && s.likePct !== undefined && s.likeUsd !== undefined

/** Largest share first. Functions with under 500 analyzed postings are left out. */
export function publicFunctionRows(): PublicFunctionRow[] {
  return Object.entries(AI_FUNCTION_STATS)
    .filter(([fn, s]) => s.n >= 500 && CRAWLER_FUNCTION_LABEL[fn])
    .map(([fn, s]) => ({
      fn,
      label: CRAWLER_FUNCTION_LABEL[fn],
      postings: s.n,
      sharePct: s.sharePct,
      rawPremiumPct: hasPremium(s) ? (s.rawPct as number) : null,
      likePremiumPct: hasPremium(s) ? (s.likePct as number) : null,
      likePremiumUsd: hasPremium(s) ? (s.likeUsd as number) : null,
    }))
    .sort((a, b) => b.sharePct - a.sharePct)
}

/** Share of all analyzed postings (the listed functions) that ask for a specific AI skill. */
export function overallSharePct(): number {
  const rows = Object.values(AI_FUNCTION_STATS)
  const total = rows.reduce((n, s) => n + s.n, 0)
  const ai = rows.reduce((n, s) => n + (s.n * s.sharePct) / 100, 0)
  return total === 0 ? 0 : Math.round((ai / total) * 1000) / 10
}

/** The like-for-like premium range across functions that have one. */
export function likePremiumRange(): { min: number; max: number } | null {
  const v = publicFunctionRows().flatMap((r) => (r.likePremiumPct === null ? [] : [r.likePremiumPct]))
  return v.length === 0 ? null : { min: Math.min(...v), max: Math.max(...v) }
}

export function skillGroupsForDisplay(): { key: string; label: string; items: string[] }[] {
  return AI_SKILL_GROUPS.map((g) => ({ key: g.key, label: g.label, items: AI_SKILL_ITEMS.filter((i) => i.group === g.key).map((i) => i.label) }))
}

const premiumFields = (p: AiPremium | undefined) =>
  p && p.likePct !== undefined && p.likeUsd !== undefined
    ? { rawPremiumPct: Math.round(p.rawPct), likePremiumPct: Math.round(p.likePct), likePremiumUsd: p.likeUsd }
    : { rawPremiumPct: null, likePremiumPct: null, likePremiumUsd: null }

/** The same rows from the live snapshot (full-text postings only). Premium needs both raw and like for like. */
export function liveFunctionRows(data: AiMarketData): PublicFunctionRow[] {
  return Object.entries(data.functions)
    .filter(([, f]) => f.n >= 500)
    .map(([fn, f]) => ({ fn, label: f.label, postings: f.n, sharePct: f.sharePct, ...premiumFields(f.premium) }))
    .sort((a, b) => b.sharePct - a.sharePct)
}

export interface LevelRow {
  fn: string
  label: string
  /** Level key -> like-for-like premium %, only where raw and like for like both exist. */
  byLevel: Partial<Record<(typeof AI_LEVELS)[number], number>>
}

export const LEVEL_COLUMNS = AI_LEVELS.map((l) => ({ key: l, label: AI_LEVEL_LABEL[l] }))

/** Functions with a like-for-like premium at two or more levels, largest first. */
export function liveLevelRows(data: AiMarketData): LevelRow[] {
  return Object.entries(data.functions)
    .map(([fn, f]) => {
      const byLevel: LevelRow['byLevel'] = {}
      for (const l of AI_LEVELS) {
        const p = f.levels[l]
        if (p && p.likePct !== undefined && p.likeUsd !== undefined) byLevel[l] = Math.round(p.likePct)
      }
      return { fn, label: f.label, n: f.n, byLevel }
    })
    .filter((r) => Object.keys(r.byLevel).length >= 2)
    .sort((a, b) => b.n - a.n)
    .map(({ fn, label, byLevel }) => ({ fn, label, byLevel }))
}

export function liveOverallSharePct(data: AiMarketData): number {
  const { aiSkillFullText, fullText } = data.counts
  return fullText ? Math.round((1000 * aiSkillFullText) / fullText) / 10 : 0
}

export interface PublicDimensionRow {
  key: string
  label: string
  postings: number
  sharePct: number
  rawPremiumPct: number | null
  likePremiumPct: number | null
  likePremiumUsd: number | null
}

/** Minimum analyzed postings in a group before it gets its own row. */
export const MIN_GROUP_POSTINGS = 300

/** Industry, state or level rows from the live snapshot. Premium needs both raw and like for like. */
export function liveDimensionRows(rows: AiDimensionRow[] | undefined, keepOrder = false): PublicDimensionRow[] {
  const out = (rows ?? [])
    .filter((r) => r.n >= MIN_GROUP_POSTINGS)
    .map((r) => ({ key: r.key, label: r.label, postings: r.n, sharePct: r.sharePct, ...premiumFields(r.premium) }))
  return keepOrder ? out : out.sort((a, b) => b.sharePct - a.sharePct)
}

/** "+18%", "-1%", "0%": the sign belongs to the number. */
export function formatPct(n: number): string {
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n)}%`
}

/** "+18% (about $29.5k)", "-1% (about -$1k)". */
export function formatPremium(pct: number, usd: number): string {
  const k = Math.round(Math.abs(usd) / 100) / 10
  return `${formatPct(pct)} (about ${usd < 0 ? '-' : ''}$${k}k)`
}
