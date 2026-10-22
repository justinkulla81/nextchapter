import { SITE_URL } from '@/lib/seo/facts'
import { PUBLIC_JOB_SITEMAP_SHARDS } from '@/lib/jobs/public-job-page'

// The sitemap index: the main sitemap plus the job sitemaps (src/app/jobs/sitemap.ts).
// Next does not write an index for generateSitemaps, so this lists them. This is the
// one URL to submit in Search Console; robots.txt points at it too.
export const dynamic = 'force-static'

export function GET() {
  const maps = [`${SITE_URL}/sitemap.xml`, ...Array.from({ length: PUBLIC_JOB_SITEMAP_SHARDS }, (_, i) => `${SITE_URL}/jobs/sitemap/${i}.xml`)]
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    maps.map((loc) => `  <sitemap><loc>${loc}</loc></sitemap>`).join('\n') +
    '\n</sitemapindex>\n'
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
