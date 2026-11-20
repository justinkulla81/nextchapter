import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { PUBLIC_JOB_SITEMAP_SHARDS, liveJobSitemapShards } from '@/lib/jobs/public-job-page'
import { publicJobsInShard } from '@/lib/jobs/public-job-page-server'
import { unstable_cache } from 'next/cache'
import { SITEMAP_REVALIDATE_SECONDS } from '@/lib/seo/sitemap-cache'

// Job sitemaps: /jobs/sitemap/0.xml … /jobs/sitemap/15.xml, listed in the sitemap index
// (src/app/sitemap-index.xml/route.ts) and robots.txt. Only jobs with a public page
// (public-job-page.ts), listed on the employer's own career system (PUBLIC_JOB_SEARCH_SQL, never Jooble or another aggregator),
// with the posting's own text (1,500+ bytes), split by a hash of the id so a job stays in the same file;
// each file is one range scan of a partial index. ~10k URLs a file, capped at 50k. lastmod is the crawl's last confirmation
// that the job is open, which also moves validThrough in the page's structured data.
export const dynamic = 'force-dynamic'

export async function generateSitemaps() {
  return Array.from({ length: PUBLIC_JOB_SITEMAP_SHARDS }, (_, id) => ({ id }))
}

// The cache holds each file's ids and dates only ([id, ms]), ~0.6 MB, and the URLs are built after the read. As finished sitemap entries
// (~150 bytes each, ~17k a file) a file was ~2.5 MB, over the data cache's 2 MB cap, so it was never stored and every fetch of a file
// read its ~17k rows again: 116 reads and ~2M rows a day (2026-11-20 egress check).
const readShard = unstable_cache(
  async (shard: number): Promise<[string, number][]> => (await publicJobsInShard(shard)).map((j) => [j.id, j.lastVerifiedAt.getTime()]),
  ['jobs-sitemap-ids-v1'],
  { revalidate: SITEMAP_REVALIDATE_SECONDS }
)

async function build(shard: number): Promise<MetadataRoute.Sitemap> {
  return (await readShard(shard)).map(([id, ms]) => ({
    url: `${SITE_URL}/jobs/${id}`,
    lastModified: new Date(ms),
    changeFrequency: 'daily',
    priority: 0.5,
  }))
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const shard = Number(await props.id)
  // A file that is not live answers with no URLs, so a crawler that still has it submitted reads an empty list (src/lib/jobs/public-job-page.ts, liveJobSitemapShards).
  if (shard >= liveJobSitemapShards()) return []
  return build(shard)
}
