import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { collegePath } from '@/lib/seo/college-bar'
import { indexableColleges } from '@/lib/seo/college-pages'
import { stateSlug } from '@/lib/seo/states'

// Served at /higher-education/sitemap.xml and listed in the sitemap index (src/app/sitemap-index.xml/route.ts): only the
// colleges that pass the page bar (college-bar.ts), with the date their facts were last loaded.
export const revalidate = 21600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rows = await indexableColleges().catch(() => [])
  return rows.map((r) => ({
    url: `${SITE_URL}${collegePath(stateSlug(r.state), r.slug)}`,
    lastModified: r.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))
}
