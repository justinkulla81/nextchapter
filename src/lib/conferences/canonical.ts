// URL and name canonicalisation for Quick Add dedupe, plus the guards on what we are willing to fetch.

const TRACKING = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|ref_src$|source$|campaign$|_hsenc$|_hsmi$|igshid$)/i

/** A stable key for an event's home page: no scheme, no www, no tracking params, no fragment, no trailing slash. */
export function canonicalUrlKey(input: string): string | null {
  let u: URL
  try { u = new URL(input.trim()) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  const kept = [...u.searchParams.entries()].filter(([k]) => !TRACKING.test(k)).sort(([a], [b]) => a.localeCompare(b))
  const qs = kept.length ? '?' + kept.map(([k, v]) => `${k}=${v}`).join('&') : ''
  const path = u.pathname.replace(/\/+$/, '')
  return `${host}${path}${qs}`
}

/** Hosts whose terms or login walls make fetching a poor idea: we store the link and the member's own words only. */
const DEEP_LINK_ONLY = ['linkedin.com', 'facebook.com', 'fb.com', 'instagram.com', 'x.com', 'twitter.com', 'meetup.com', 'eventbrite.com', 'eventbrite.co.uk', 'lu.ma', 'tiktok.com']

export function isDeepLinkOnly(input: string): boolean {
  try {
    const host = new URL(input).hostname.toLowerCase().replace(/^www\./, '')
    return DEEP_LINK_ONLY.some((d) => host === d || host.endsWith('.' + d))
  } catch { return false }
}

/** Refuses localhost, private ranges and non-http(s): Quick Add must never become a way to probe our own network. */
export function isPublicHttpUrl(input: string): boolean {
  let u: URL
  try { u = new URL(input) } catch { return false }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  if (u.username || u.password) return false
  const h = u.hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.') && !h.includes(':')) return false
  if (h.includes(':') || h.startsWith('[')) return false // IPv6 literals
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224) return false
  }
  return true
}

const NOISE = /\b(the|annual|conference|conf|summit|expo|forum|congress|symposium|convention|and|of|for|20\d\d)\b/g

/** Name with the year and filler words removed, so "HR Tech 2027" and "HR Technology Conference" collide where they should. */
export function nameKey(name: string): string {
  return name.toLowerCase().replace(/&/g, ' and ').replace(NOISE, ' ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

/** The year in a name or URL ("hrtech2027", "Summit 2026"), else null. */
export function yearFromText(...parts: (string | null | undefined)[]): number | null {
  for (const p of parts) {
    const m = p?.match(/(?:^|[^0-9])(20[2-4]\d)(?:[^0-9]|$)/)
    if (m) return Number(m[1])
  }
  return null
}

export const seriesSlug = (s: string) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
