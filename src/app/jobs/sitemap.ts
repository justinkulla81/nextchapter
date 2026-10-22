import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { PUBLIC_JOB_SITEMAP_SHARDS } from '@/lib/jobs/public-job-page'
import { publicJobsInShard } from '@/lib/jobs/public-job-page-server'

// Job sitemaps: /jobs/sitemap/0.xml … /jobs/sitemap/15.xml, listed in the sitemap index
// (src/app/sitemap-index.xml/route.ts) and robots.txt. Only jobs with a public page
// (public-job-page.ts), split by a hash of the id so a job stays in the same file; each
// file is one range scan of a partial index. ~20k URLs a file today, capped at 50k.
export const revalidate = 21600

export async function generateSitemaps() {
  return Array.from({ length: PUBLIC_JOB_SITEMAP_SHARDS }, (_, id) => ({ id }))
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const shard = Number(await props.id)
  const jobs = await publicJobsInShard(shard)
  return jobs.map((j) => ({
    url: `${SITE_URL}/jobs/${j.id}`,
    lastModified: j.lastVerifiedAt,
    changeFrequency: 'daily',
    priority: 0.5,
  }))
}
