import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { ORG_SITEMAP_SHARD_SIZE } from '@/lib/seo/org-page-rules'
import { cachedIndexableOrgPages } from '@/lib/seo/org-pages'

// Economic development organizations sitemaps: /economic-development/sitemap/0.xml, 1.xml … (ORG_SITEMAP_SHARD_SIZE URLs a file), listed in the sitemap index
// (src/app/sitemap-index.xml/route.ts). Only pages that meet the content bar (src/lib/seo/org-page-rules.ts);
// lastmod is the newer of the organization's own record and the newest job posted in its area.
export const revalidate = 21600

export async function generateSitemaps() {
  const n = (await cachedIndexableOrgPages('ECON_DEV').catch(() => [])).length
  return Array.from({ length: Math.max(1, Math.ceil(n / ORG_SITEMAP_SHARD_SIZE)) }, (_, id) => ({ id }))
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const shard = Number(await props.id)
  const all = await cachedIndexableOrgPages('ECON_DEV')
  return all.slice(shard * ORG_SITEMAP_SHARD_SIZE, (shard + 1) * ORG_SITEMAP_SHARD_SIZE).map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: p.lastModified,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))
}
