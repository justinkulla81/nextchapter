import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { SEARCH_FIRM_SITEMAP_SHARD_SIZE, countSearchFirmPages, searchFirmsInShard } from '@/lib/seo/search-firm-pages'
import { cachedSitemap } from '@/lib/seo/sitemap-cache'

// Search-firm sitemaps: /search-firms/sitemap/0.xml … (10,000 URLs a file), listed in the sitemap index
// (src/app/sitemap-index.xml/route.ts). Only firms that pass the page bar (search-firm-bar.ts).
export const dynamic = 'force-dynamic'

export async function generateSitemaps() {
  const n = await countSearchFirmPages().catch(() => 0)
  return Array.from({ length: Math.max(1, Math.ceil(n / SEARCH_FIRM_SITEMAP_SHARD_SIZE)) }, (_, id) => ({ id }))
}

const build = cachedSitemap('search-firms-sitemap-v1', async (shard: number): Promise<MetadataRoute.Sitemap> => {
  const rows = await searchFirmsInShard(shard)
  return rows.map((r) => ({ url: `${SITE_URL}/search-firms/${r.slug}`, lastModified: r.lastModified, changeFrequency: 'weekly', priority: 0.5 }))
})

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const shard = Number(await props.id)
  try {
    return await build(shard)
  } catch (error) {
    console.error('search-firms sitemap: database busy, serving an empty file:', error instanceof Error ? error.message : String(error))
    return []
  }
}
