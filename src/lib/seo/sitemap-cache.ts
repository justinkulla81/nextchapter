import 'server-only'
import type { MetadataRoute } from 'next'
import { unstable_cache } from 'next/cache'

// The database-backed sitemaps are not built during a deploy: the build runs many pages at once, and a sitemap that
// reads tens of thousands of rows then times out or starves the connection pool, which failed several production
// deploys on 2026-10-26. A sitemap route that uses this is dynamic (`export const dynamic = 'force-dynamic'`), and its
// finished list is kept in the data cache for six hours (a stale copy is served while it refreshes). A failed run throws
// and is never cached.
export const SITEMAP_REVALIDATE_SECONDS = 6 * 60 * 60

export function cachedSitemap<A extends (string | number)[]>(key: string, build: (...args: A) => Promise<MetadataRoute.Sitemap>) {
  return unstable_cache(
    async (...args: A): Promise<MetadataRoute.Sitemap> => JSON.parse(JSON.stringify(await build(...args))) as MetadataRoute.Sitemap,
    [key],
    { revalidate: SITEMAP_REVALIDATE_SECONDS },
  )
}
