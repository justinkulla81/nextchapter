import { unstable_cache } from 'next/cache'
import { SITE_URL } from '@/lib/seo/facts'
import { PUBLIC_JOB_SITEMAP_SHARDS } from '@/lib/jobs/public-job-page'
import { EMPLOYER_SITEMAP_SHARD_SIZE, countEmployerPages } from '@/lib/seo/employer-pages'
import { ORG_SITEMAP_SHARD_SIZE } from '@/lib/seo/org-page-rules'
import { cachedIndexableOrgPages } from '@/lib/seo/org-pages'
import { SEARCH_FIRM_SITEMAP_SHARD_SIZE, countSearchFirmPages } from '@/lib/seo/search-firm-pages'

// The sitemap index: the main sitemap, the job sitemaps (src/app/jobs/sitemap.ts) and the employer sitemaps
// (src/app/employers/sitemap.ts), the place pages (src/app/places/sitemap.ts), and the American Job Center and
// economic development pages (src/app/job-centers/sitemap.ts, src/app/economic-development/sitemap.ts). The college pages are in
// src/app/higher-education/sitemap.ts.
// Next does not write an index for generateSitemaps, so this lists them. This is the
// one URL to submit in Search Console; robots.txt points at it too.
// Rebuilt hourly: the number of employer files follows the number of employers that pass the page bar.
export const dynamic = 'force-dynamic'

async function listMaps(): Promise<string[]> {
  const employers = await countEmployerPages().catch(() => 0)
  const employerShards = Math.max(1, Math.ceil(employers / EMPLOYER_SITEMAP_SHARD_SIZE))
  const shards = async (kind: 'JOB_CENTER' | 'ECON_DEV') =>
    Math.max(1, Math.ceil((await cachedIndexableOrgPages(kind).catch(() => [])).length / ORG_SITEMAP_SHARD_SIZE))
  const [centerShards, econShards] = await Promise.all([shards('JOB_CENTER'), shards('ECON_DEV')])
  const searchFirmShards = Math.max(1, Math.ceil((await countSearchFirmPages().catch(() => 0)) / SEARCH_FIRM_SITEMAP_SHARD_SIZE))
  return [
    `${SITE_URL}/sitemap.xml`,
    `${SITE_URL}/places/sitemap.xml`,
    `${SITE_URL}/events/sitemap.xml`,
    `${SITE_URL}/higher-education/sitemap.xml`,
    `${SITE_URL}/salaries/sitemap.xml`,
    ...Array.from({ length: PUBLIC_JOB_SITEMAP_SHARDS }, (_, i) => `${SITE_URL}/jobs/sitemap/${i}.xml`),
    ...Array.from({ length: employerShards }, (_, i) => `${SITE_URL}/employers/sitemap/${i}.xml`),
    ...Array.from({ length: centerShards }, (_, i) => `${SITE_URL}/job-centers/sitemap/${i}.xml`),
    ...Array.from({ length: econShards }, (_, i) => `${SITE_URL}/economic-development/sitemap/${i}.xml`),
    ...Array.from({ length: searchFirmShards }, (_, i) => `${SITE_URL}/search-firms/sitemap/${i}.xml`),
  ]
}

// The shard counts come from the database; they are kept for an hour so a crawler asking for the index does not run them each time.
const cachedMaps = unstable_cache(listMaps, ['sitemap-index-v1'], { revalidate: 3600 })

export async function GET() {
  const maps = await cachedMaps()
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    maps.map((loc) => `  <sitemap><loc>${loc}</loc></sitemap>`).join('\n') +
    '\n</sitemapindex>\n'
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
