import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { archiveMonths } from '@/lib/rankings/awards'
import { skillPageSlugs } from '@/lib/rankings/skill-pages'
import { readRankingIndex } from '@/lib/rankings/store'
import { topicSlug } from '@/lib/rankings/topics'

// /rankings/sitemap.xml: the hub, the archive and each month in it, each ranking's own address, and each older edition at its dated address. The newest
// edition's dated address is not listed: it redirects to the ranking's own address.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const index = await readRankingIndex().catch(() => [])
  const urls: MetadataRoute.Sitemap = [{ url: `${SITE_URL}/rankings`, changeFrequency: 'monthly', priority: 0.8 }]
  for (const x of index) {
    urls.push({ url: `${SITE_URL}/rankings/${x.slug}`, lastModified: `${x.edition}-01`, changeFrequency: 'monthly', priority: x.scopeKind === 'national' ? 0.8 : 0.6 })
    for (const ed of x.editions.slice(1)) urls.push({ url: `${SITE_URL}/rankings/${x.slug}/${ed}`, lastModified: `${ed}-01`, changeFrequency: 'never', priority: 0.4 })
  }
  for (const f of new Set(index.map((x) => x.family))) urls.push({ url: `${SITE_URL}/rankings/topic/${topicSlug(f)}`, changeFrequency: 'monthly', priority: 0.6 })
  const months = archiveMonths(index)
  if (months.length) {
    urls.push({ url: `${SITE_URL}/rankings/archive`, lastModified: `${months[0]}-01`, changeFrequency: 'monthly', priority: 0.5 })
    for (const ed of months) urls.push({ url: `${SITE_URL}/rankings/archive/${ed}`, lastModified: `${ed}-01`, changeFrequency: ed === months[0] ? 'monthly' : 'never', priority: 0.5 })
  }
  for (const slug of await skillPageSlugs().catch(() => [])) urls.push({ url: `${SITE_URL}/ai-skills/${slug}`, changeFrequency: 'monthly', priority: 0.5 })
  return urls
}
