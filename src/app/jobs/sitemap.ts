import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { PUBLIC_JOB_SITEMAP_SHARDS } from '@/lib/jobs/public-job-page'
import { publicJobsInShard } from '@/lib/jobs/public-job-page-server'
import { cachedSitemap } from '@/lib/seo/sitemap-cache'

// Job sitemaps: /jobs/sitemap/0.xml … /jobs/sitemap/15.xml, listed in the sitemap index
// (src/app/sitemap-index.xml/route.ts) and robots.txt. Only jobs with a public page
// (public-job-page.ts) that we offer to search engines (PUBLIC_JOB_OFFERED_SQL: stated pay, entry-level or no experience),
// split by a hash of the id so a job stays in the same file; each file is one range scan of a partial index. ~3k URLs a file
// today, capped at 50k.
export const dynamic = 'force-dynamic'

export async function generateSitemaps() {
  return Array.from({ length: PUBLIC_JOB_SITEMAP_SHARDS }, (_, id) => ({ id }))
}

const build = cachedSitemap('jobs-sitemap-v2', async (shard: number): Promise<MetadataRoute.Sitemap> => {
  const jobs = await publicJobsInShard(shard)
  return jobs.map((j) => ({
    url: `${SITE_URL}/jobs/${j.id}`,
    lastModified: j.lastVerifiedAt,
    changeFrequency: 'daily',
    priority: 0.5,
  }))
})

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  return build(Number(await props.id))
}
