// The heavy public SEO pages that the PAUSE_HEAVY_PAGES emergency brake switches off (src/proxy.ts) and hides from
// crawlers (src/app/robots.ts). Their big aggregate queries once exhausted the database connection pool.
//
// PAUSE_HEAVY_PAGES=1 pauses every prefix below. A comma-separated list of prefixes (for example "/conferences,/places") pauses only those,
// so the pages can be switched back on one section at a time. Unset or anything else: nothing is paused.
export const PAUSED_HEAVY_PREFIXES = ['/industries', '/functions', '/conferences', '/associations', '/places', '/topics']

/** The prefixes that are paused right now. */
export function pausedPrefixes(value: string | undefined = process.env.PAUSE_HEAVY_PAGES): string[] {
  const v = (value ?? '').trim()
  if (v === '1') return PAUSED_HEAVY_PREFIXES
  if (!v.startsWith('/')) return []
  return v.split(',').map((p) => p.trim()).filter((p) => PAUSED_HEAVY_PREFIXES.includes(p))
}

export const HEAVY_PAGES_PAUSED = () => pausedPrefixes().length > 0
