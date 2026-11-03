import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { cachedSitemap } from '@/lib/seo/sitemap-cache'
import { loadPayData } from '@/lib/pay-data/load'
import { functionPayPath, industryPayPath, skillPath } from '@/lib/pay-data/slugs'

// The pay data pages, at /resources/pay-data/sitemap.xml and listed in the sitemap index (src/app/sitemap-index.xml/route.ts). Only groups and
// skills that passed the publish bars appear, so every address listed answers. Empty until the first daily run stores the figures.
export const dynamic = 'force-dynamic'

const build = cachedSitemap('pay-data-sitemap-v1', async (): Promise<MetadataRoute.Sitemap> => {
  const d = await loadPayData()
  if (!d) return []
  const lastModified = new Date(d.computedAt)
  const u = (p: string, priority: number) => ({ url: `${SITE_URL}${p}`, lastModified, changeFrequency: 'weekly' as const, priority })
  return [
    u('/resources/pay-data', 0.8),
    ...['industry', 'function', 'size', 'hiring', 'skills'].map((c) => u(`/resources/pay-data/${c}`, 0.7)),
    ...d.byIndustry.map((g) => u(industryPayPath(g.key), 0.6)),
    ...d.byFunction.map((g) => u(functionPayPath(g.label), 0.6)),
    ...d.skills.map((s) => u(skillPath(s), 0.5)),
  ]
})

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return build()
}
