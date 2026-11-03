import { getIndustryNotices, getRecentNotices } from '@/lib/seo/topic-data'
import { industryByName } from '@/lib/seo/topics'
import { hasLayoffStatePage } from '@/lib/warn/layoff-pages'
import { stateName, stateSlug } from '@/lib/seo/states'

export interface IndustryCount { name: string; href: string; notices: number; workers: number }
export interface StateCount { name: string; href: string; notices: number; workers: number }

/**
 * The industry pages behind a set of layoff notices, biggest first. Notices are matched to their industry by id against the
 * 12-month topic notices, so older notices (a past week or month) simply add nothing. An industry is linked only when it has a page
 * (the "Other" bucket has none).
 */
export async function industryCountsForNotices(notices: { id: string; workers: number | null }[], limit = 8): Promise<IndustryCount[]> {
  const bucketById = new Map((await getRecentNotices()).map((n) => [n.id, n.bucket]))
  const by = new Map<string, IndustryCount>()
  for (const n of notices) {
    const ind = industryByName(bucketById.get(n.id))
    if (!ind) continue
    const e = by.get(ind.slug) ?? { name: ind.name, href: `/industries/${ind.slug}`, notices: 0, workers: 0 }
    e.notices++
    e.workers += n.workers ?? 0
    by.set(ind.slug, e)
  }
  return [...by.values()].sort((a, b) => b.workers - a.workers || b.notices - a.notices).slice(0, limit)
}

/** The state layoff pages behind an industry's recent notices, biggest first; a state is linked only when its page exists. */
export async function stateCountsForIndustry(bucket: string, limit = 12): Promise<StateCount[]> {
  const by = new Map<string, StateCount & { code: string }>()
  for (const n of await getIndustryNotices(bucket)) {
    const e = by.get(n.state) ?? { code: n.state, name: stateName(n.state), href: `/layoffs/${stateSlug(n.state)}`, notices: 0, workers: 0 }
    e.notices++
    e.workers += n.workers ?? 0
    by.set(n.state, e)
  }
  const top = [...by.values()].sort((a, b) => b.workers - a.workers || b.notices - a.notices).slice(0, limit)
  const live = await Promise.all(top.map((s) => hasLayoffStatePage(s.code).catch(() => false)))
  return top.filter((_, i) => live[i])
}
