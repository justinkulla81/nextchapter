import 'server-only'
import { skillSlug } from '@/lib/rankings/awards'
import { readRanking, readRankingIndex } from '@/lib/rankings/store'
import type { RankRow, RankingEdition } from '@/lib/rankings/types'

// A page for each AI skill and tool, built from the newest "all job families" lists. The row's key ("skill:..." or "tool:...") is
// the key its placings are stored under (awards.ts), so the page can show where it ranked each month.

const LISTS = [
  { slug: 'most-requested-ai-skills', kind: 'skill' as const },
  { slug: 'ai-tools-named-most-often', kind: 'tool' as const },
]

export interface SkillPage { kind: 'skill' | 'tool'; row: RankRow; list: RankingEdition; peers: RankRow[] }

async function newest(slug: string): Promise<RankingEdition | null> {
  const x = (await readRankingIndex().catch(() => [])).find((e) => e.slug === slug)
  return x ? readRanking(slug, x.edition).catch(() => null) : null
}

export async function loadSkillPage(slug: string): Promise<SkillPage | null> {
  for (const l of LISTS) {
    const list = await newest(l.slug)
    const row = list?.rows.find((r) => skillSlug(r.name) === slug)
    if (list && row) return { kind: l.kind, row, list, peers: list.rows.filter((r) => r.key !== row.key).slice(0, 10) }
  }
  return null
}

/** Every skill and tool that has a page: the rows of the two lists. */
export async function skillPageSlugs(): Promise<string[]> {
  const lists = await Promise.all(LISTS.map((l) => newest(l.slug)))
  return lists.flatMap((l) => l?.rows.map((r) => skillSlug(r.name)) ?? [])
}
