import { SITE_URL } from '@/lib/seo/facts'
import { PUBLIC_JOB_SITEMAP_SHARDS } from '@/lib/jobs/public-job-page'
import { EMPLOYER_SITEMAP_SHARD_SIZE, countEmployerPages } from '@/lib/seo/employer-pages'
import { SEARCH_FIRM_SITEMAP_SHARD_SIZE, countSearchFirmPages } from '@/lib/seo/search-firm-pages'

// The sitemap index: the main sitemap, the job sitemaps (src/app/jobs/sitemap.ts) and the employer sitemaps
// (src/app/employers/sitemap.ts) and the place pages (src/app/places/sitemap.ts).
// Next does not write an index for generateSitemaps, so this lists them. This is the
// one URL to submit in Search Console; robots.txt points at it too.
// Rebuilt hourly: the number of employer files follows the number of employers that pass the page bar.
export const revalidate = 3600

export async function GET() {
  const employers = await countEmployerPages().catch(() => 0)
  const employerShards = Math.max(1, Math.ceil(employers / EMPLOYER_SITEMAP_SHARD_SIZE))
  const searchFirmShards = Math.max(1, Math.ceil((await countSearchFirmPages().catch(() => 0)) / SEARCH_FIRM_SITEMAP_SHARD_SIZE))
  const maps = [
    `${SITE_URL}/sitemap.xml`,
    `${SITE_URL}/places/sitemap.xml`,
    `${SITE_URL}/salaries/sitemap.xml`,
    ...Array.from({ length: PUBLIC_JOB_SITEMAP_SHARDS }, (_, i) => `${SITE_URL}/jobs/sitemap/${i}.xml`),
    ...Array.from({ length: employerShards }, (_, i) => `${SITE_URL}/employers/sitemap/${i}.xml`),
    ...Array.from({ length: searchFirmShards }, (_, i) => `${SITE_URL}/search-firms/sitemap/${i}.xml`),
  ]
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    maps.map((loc) => `  <sitemap><loc>${loc}</loc></sitemap>`).join('\n') +
    '\n</sitemapindex>\n'
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
