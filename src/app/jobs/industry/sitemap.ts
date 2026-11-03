import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { readSegmentIndex } from '@/lib/segments/store'

// /jobs/industry/sitemap.xml: the hub, each segment's page, each of its lists, and each older month at its dated address (the
// newest month is the segment's own address).
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const index = await readSegmentIndex().catch(() => [])
  const urls: MetadataRoute.Sitemap = [{ url: `${SITE_URL}/jobs/industry`, changeFrequency: 'weekly', priority: 0.7 }]
  for (const x of index) {
    urls.push({ url: `${SITE_URL}/jobs/industry/${x.slug}`, lastModified: `${x.editions[0]}-01`, changeFrequency: 'weekly', priority: 0.7 })
    for (const cut of x.cuts) urls.push({ url: `${SITE_URL}/jobs/industry/${x.slug}/${cut}`, lastModified: `${x.editions[0]}-01`, changeFrequency: 'weekly', priority: 0.6 })
    for (const ed of x.editions.slice(1)) urls.push({ url: `${SITE_URL}/jobs/industry/${x.slug}/${ed}`, lastModified: `${ed}-01`, changeFrequency: 'never', priority: 0.4 })
  }
  return urls
}
