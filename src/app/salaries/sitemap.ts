import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { JOB_TYPES, getTitleIndex, hasSalaryPage } from '@/lib/seo/job-titles'

// The salary pages, the job-title pages and the job-type pages, served at /salaries/sitemap.xml and listed in the
// sitemap index (src/app/sitemap-index.xml/route.ts). Titles are the ones with enough open listings (job-title-rules.ts).
export const revalidate = 21600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const index = await getTitleIndex()
  const now = new Date()
  return [
    { url: `${SITE_URL}/salaries`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/jobs/title`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    ...JOB_TYPES.map((t) => ({ url: `${SITE_URL}/jobs/type/${t.slug}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.7 })),
    ...index.map((t) => ({ url: `${SITE_URL}/jobs/title/${t.slug}`, changeFrequency: 'daily' as const, priority: 0.5 })),
    ...index.filter(hasSalaryPage).map((t) => ({ url: `${SITE_URL}/salaries/${t.slug}`, changeFrequency: 'weekly' as const, priority: 0.6 })),
  ]
}
