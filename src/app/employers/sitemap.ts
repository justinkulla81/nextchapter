import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { EMPLOYER_SITEMAP_SHARD_SIZE, countEmployerPages, employersInShard } from '@/lib/seo/employer-pages'
import { employerSlug } from '@/lib/seo/employer-slug'

// Employer sitemaps: /employers/sitemap/0.xml, 1.xml … (10,000 URLs a file), listed in the sitemap index
// (src/app/sitemap-index.xml/route.ts). Only employers that pass the page bar (employer-pages.ts).
export const revalidate = 21600

export async function generateSitemaps() {
  const n = await countEmployerPages().catch(() => 0)
  return Array.from({ length: Math.max(1, Math.ceil(n / EMPLOYER_SITEMAP_SHARD_SIZE)) }, (_, id) => ({ id }))
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const shard = Number(await props.id)
  const rows = await employersInShard(shard).catch(() => [])
  return rows.map((r) => ({
    url: `${SITE_URL}/employers/${employerSlug(r.canonical, r.id)}`,
    lastModified: r.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))
}
