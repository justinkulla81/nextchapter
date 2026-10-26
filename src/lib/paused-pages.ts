// The heavy public SEO pages that the PAUSE_HEAVY_PAGES=1 emergency brake switches off (src/proxy.ts) and hides from
// crawlers (src/app/robots.ts). Their big aggregate queries once exhausted the database connection pool.
export const PAUSED_HEAVY_PREFIXES = ['/industries', '/functions', '/conferences', '/associations', '/places', '/topics']
export const HEAVY_PAGES_PAUSED = () => process.env.PAUSE_HEAVY_PAGES === '1'
