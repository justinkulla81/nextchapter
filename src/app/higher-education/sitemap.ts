import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { areaSlug, collegePath } from '@/lib/seo/college-bar'
import { indexableColleges } from '@/lib/seo/college-pages'
import { MAJORS, MAJORS_PATH, majorPath } from '@/lib/rankings/majors'

// Served at /higher-education/sitemap.xml and listed in the sitemap index (src/app/sitemap-index.xml/route.ts): only the
// colleges that pass the page bar (college-bar.ts), with the date their facts were last loaded.
// Rendered on request, never at build: it reads every state's colleges (a 51-state walk the build must not run).
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rows = await indexableColleges()
  // The majors pages (static federal data plus the monthly field figures): the index and one page per major.
  const month = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
  const majors: MetadataRoute.Sitemap = [MAJORS_PATH, ...MAJORS.map((m) => majorPath(m))].map((p) => ({ url: `${SITE_URL}${p}`, lastModified: month, changeFrequency: 'monthly', priority: 0.5 }))
  return [
    ...rows.map((r) => ({
      url: `${SITE_URL}${collegePath(areaSlug(r.state), r.slug)}`,
      lastModified: r.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
    ...majors,
  ]
}
