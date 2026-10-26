import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { EMPLOYER_SITEMAP_SHARD_SIZE, countEmployerPages, employersInShard } from '@/lib/seo/employer-pages'
import { employerSlug } from '@/lib/seo/employer-slug'
import { cachedSitemap } from '@/lib/seo/sitemap-cache'

// Employer sitemaps: /employers/sitemap/0.xml, 1.xml … (10,000 URLs a file), listed in the sitemap index
// (src/app/sitemap-index.xml/route.ts). Only employers that pass the page bar (employer-pages.ts).
export const dynamic = 'force-dynamic'

export async function generateSitemaps() {
  const n = await countEmployerPages().catch(() => 0)
  return Array.from({ length: Math.max(1, Math.ceil(n / EMPLOYER_SITEMAP_SHARD_SIZE)) }, (_, id) => ({ id }))
}

const build = cachedSitemap('employers-sitemap-v1', async (shard: number): Promise<MetadataRoute.Sitemap> => {
  const rows = await employersInShard(shard)
  return rows.map((r) => ({
    url: `${SITE_URL}/employers/${employerSlug(r.canonical, r.id)}`,
    lastModified: r.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))
})

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const shard = Number(await props.id)
  try {
    return await build(shard)
  } catch (error) {
    console.error('employers sitemap: database busy, serving an empty file:', error instanceof Error ? error.message : String(error))
    return []
  }
}
