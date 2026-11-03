import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { cachedSitemap } from '@/lib/seo/sitemap-cache'
import { ENTRY_CATEGORIES, ENTRY_ROLES } from '@/lib/entry-roles/roles'
import { getEntryPlaceIndex } from '@/lib/entry-roles/live'

// The entry-level role pages, category pages and role-by-place pages, at /jobs/entry-level/sitemap.xml (listed in the sitemap index).
// Role and category pages are always listed (they explain the job whether or not openings exist); a place page is listed only when it
// has a stored row, so every address listed answers.
export const dynamic = 'force-dynamic'

const build = cachedSitemap('entry-level-sitemap-v1', async (): Promise<MetadataRoute.Sitemap> => {
  const places = await getEntryPlaceIndex()
  const now = new Date()
  return [
    { url: `${SITE_URL}/jobs/entry-level`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    ...ENTRY_CATEGORIES.map((c) => ({ url: `${SITE_URL}/jobs/entry-level/category/${c.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...ENTRY_ROLES.map((r) => ({ url: `${SITE_URL}/jobs/entry-level/${r.slug}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.7 })),
    ...places.map(([slug, key]) => ({ url: `${SITE_URL}/jobs/entry-level/${slug}/${key}`, changeFrequency: 'daily' as const, priority: 0.4 })),
  ]
})

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return build()
}
