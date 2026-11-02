import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { JOB_TYPES, getTitleIndex, getTitlePlaceIndex, hasSalaryPage } from '@/lib/seo/job-titles'
import { cachedSitemap } from '@/lib/seo/sitemap-cache'

// The salary pages, the job-title pages and the job-type pages, served at /salaries/sitemap.xml and listed in the
// sitemap index (src/app/sitemap-index.xml/route.ts). Titles are the ones with enough open listings (job-title-rules.ts).
export const dynamic = 'force-dynamic'

const build = cachedSitemap('salaries-sitemap-v2', async (): Promise<MetadataRoute.Sitemap> => {
  const [index, places] = await Promise.all([getTitleIndex(), getTitlePlaceIndex()])
  const now = new Date()
  return [
    { url: `${SITE_URL}/salaries`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/jobs/title`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    ...JOB_TYPES.map((t) => ({ url: `${SITE_URL}/jobs/type/${t.slug}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.7 })),
    ...index.map((t) => ({ url: `${SITE_URL}/jobs/title/${t.slug}`, changeFrequency: 'daily' as const, priority: 0.5 })),
    ...index.filter(hasSalaryPage).map((t) => ({ url: `${SITE_URL}/salaries/${t.slug}`, changeFrequency: 'weekly' as const, priority: 0.6 })),
    // Title-by-place pages: only the pairs that have a stored page (job-title-places.ts holds the bar), so every address listed answers.
    ...places.map(([slug, key]) => ({ url: `${SITE_URL}/jobs/title/${slug}/${key}`, changeFrequency: 'daily' as const, priority: 0.4 })),
  ]})

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return build()
}
