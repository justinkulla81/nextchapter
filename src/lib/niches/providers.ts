import 'server-only'
import { prisma } from '@/lib/prisma'
import { displayName, hostFromUrl, slugFor } from '@/lib/marketing/alternative-core'
import { listIndexableAlternatives } from '@/lib/marketing/alternatives'
import type { Niche } from './niches'

export interface NicheProvider {
  name: string
  host: string
  url: string
  /** Slug of our generated comparison page for this company, when it has an indexable one. */
  compareSlug: string | null
}

const MAX_LISTED = 80

/**
 * Companies in a niche: name and link to their own site, nothing else. Descriptions and claims in the database are
 * model-drafted and marked "needs review", so they are not shown here. Fail-soft: an error returns an empty list.
 */
export async function getNicheProviders(niche: Niche): Promise<NicheProvider[]> {
  try {
    const rows = await prisma.productCompetitor.findMany({
      where: {
        status: { in: ['ACTIVE', 'ACQUIRED'] },
        relationship: { not: 'NOT_A_COMPETITOR' },
        url: { not: null },
        OR: [...(niche.categories.length ? [{ category: { in: niche.categories } }] : []), ...(niche.includeNames?.length ? [{ name: { in: niche.includeNames } }] : [])],
      },
      select: { name: true, url: true, monthlyVisits: true },
    })
    if (!rows.length) return []
    const compare = new Set((await listIndexableAlternatives()).map((p) => p.slug))
    const seen = new Set<string>()
    return rows
      .sort((a, b) => (b.monthlyVisits ?? -1) - (a.monthlyVisits ?? -1) || a.name.localeCompare(b.name))
      .flatMap((r) => {
        const host = hostFromUrl(r.url)
        const slug = slugFor(r.name)
        if (!host || !slug || seen.has(slug) || !/^https:\/\//.test(r.url ?? '')) return []
        seen.add(slug)
        return [{ name: displayName(r.name), host, url: r.url as string, compareSlug: compare.has(slug) ? slug : null }]
      })
      .slice(0, MAX_LISTED)
  } catch {
    return []
  }
}
