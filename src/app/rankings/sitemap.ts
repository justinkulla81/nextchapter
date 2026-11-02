import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { readRankingIndex } from '@/lib/rankings/store'

// /rankings/sitemap.xml: the hub, each ranking's own address, and each older edition at its dated address. The newest
// edition's dated address is not listed: it redirects to the ranking's own address.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const index = await readRankingIndex().catch(() => [])
  const urls: MetadataRoute.Sitemap = [{ url: `${SITE_URL}/rankings`, changeFrequency: 'monthly', priority: 0.8 }]
  for (const x of index) {
    urls.push({ url: `${SITE_URL}/rankings/${x.slug}`, lastModified: `${x.edition}-01`, changeFrequency: 'monthly', priority: x.scopeKind === 'national' ? 0.8 : 0.6 })
    for (const ed of x.editions.slice(1)) urls.push({ url: `${SITE_URL}/rankings/${x.slug}/${ed}`, lastModified: `${ed}-01`, changeFrequency: 'never', priority: 0.4 })
  }
  return urls
}
