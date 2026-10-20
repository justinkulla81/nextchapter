// What the public /ai-skills page shows, built from the static analysis (ai-skill-market.data.ts).
// Pure and client-safe; tested in src/test/ai-skills-public.test.ts. A premium is shown only
// when both the raw and the like-for-like numbers exist, never one alone (same rule as aiMarketLine).

import { CRAWLER_FUNCTION_LABEL } from '@/lib/jobs/job-functions'
import { AI_FUNCTION_STATS, type AiFunctionStat } from '@/lib/skills/ai-skill-market.data'
import { AI_SKILL_GROUPS, AI_SKILL_ITEMS } from '@/lib/skills/ai-skills'

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
