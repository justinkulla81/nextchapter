import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { collegePath } from '@/lib/seo/college-bar'
import { indexableColleges } from '@/lib/seo/college-pages'
import { stateSlug } from '@/lib/seo/states'

// Served at /higher-education/sitemap.xml and listed in the sitemap index (src/app/sitemap-index.xml/route.ts): only the
// colleges that pass the page bar (college-bar.ts), with the date their facts were last loaded.
// Rendered on request, never at build: it reads every state's colleges (a 51-state walk the build must not run).
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rows = await indexableColleges()
  return rows.map((r) => ({
    url: `${SITE_URL}${collegePath(stateSlug(r.state), r.slug)}`,
    lastModified: r.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))
}
