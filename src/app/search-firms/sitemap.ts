import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { SEARCH_FIRM_SITEMAP_SHARD_SIZE, countSearchFirmPages, searchFirmsInShard } from '@/lib/seo/search-firm-pages'

// Search-firm sitemaps: /search-firms/sitemap/0.xml … (10,000 URLs a file), listed in the sitemap index
// (src/app/sitemap-index.xml/route.ts). Only firms that pass the page bar (search-firm-bar.ts).
export const revalidate = 21600

export async function generateSitemaps() {
  const n = await countSearchFirmPages().catch(() => 0)
  return Array.from({ length: Math.max(1, Math.ceil(n / SEARCH_FIRM_SITEMAP_SHARD_SIZE)) }, (_, id) => ({ id }))
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const shard = Number(await props.id)
  const rows = await searchFirmsInShard(shard).catch(() => [])
  return rows.map((r) => ({ url: `${SITE_URL}/search-firms/${r.slug}`, lastModified: r.lastModified, changeFrequency: 'weekly', priority: 0.5 }))
}
