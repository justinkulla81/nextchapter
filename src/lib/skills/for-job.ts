// The skills worth showing on a job listing: the terms the posting names that are on the skills market (so each has a page),
// the ones asked for most across the board first. Pure; tests in src/test/skills-claim.test.ts.

import { skillSlug } from '@/lib/rankings/awards'
import type { SkillMarket } from '@/lib/skills/market'

export interface JobSkill { slug: string; name: string }

export function skillsForPosting(terms: readonly string[], market: SkillMarket | null, limit = 5): JobSkill[] {
  if (!market || terms.length === 0) return []
  const bySlug = new Map(market.skills.map((s) => [s.slug, s]))
  const seen = new Set<string>()
  const found: { slug: string; name: string; n: number }[] = []
  for (const term of terms) {
    const slug = skillSlug(term)
    const row = bySlug.get(slug)
    if (!row || seen.has(slug)) continue
    seen.add(slug)
    found.push({ slug, name: row.name, n: row.n })
  }
  return found.sort((a, b) => b.n - a.n).slice(0, limit).map(({ slug, name }) => ({ slug, name }))
}
