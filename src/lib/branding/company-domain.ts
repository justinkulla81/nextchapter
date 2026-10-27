import { normalizeOrgName } from '@/lib/text/org-name-match'

// Finding a company's own website when we do not have one on file (796 of 88,857 companies do). Pure: it builds candidate addresses from the
// company's name and decides whether a page is that company's. A guessed address is used only when its home page names the company; a page
// that only looks plausible is never used, because the wrong company's colors on a page is worse than none.

const STOP = new Set(['the', 'of', 'and', 'inc', 'llc', 'ltd', 'co', 'corp', 'corporation', 'company', 'group', 'holdings', 'international', 'services', 'solutions', 'systems', 'america', 'american', 'usa', 'us', 'north', 'national'])

/** The words that identify the company, in order: no legal suffixes, no filler. */
export function nameTokens(name: string): string[] {
  return normalizeOrgName(name)
    .replace(/&/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 2 && !STOP.has(t))
}

const sanitize = (s: string) => s.replace(/[^a-z0-9]/g, '')

/**
 * Likely home-page hosts for a company, best first: every word joined ("wellsfargo.com"), the first word alone when it is long enough to be
 * unambiguous, the first two joined, in .com and, for names that read as non-profit or schools, .org and .edu.
 */
export function guessHosts(name: string): string[] {
  const full = normalizeOrgName(name)
  const tokens = nameTokens(name)
  if (tokens.length === 0) return []
  const keepAll = sanitize(full.replace(/&/g, 'and'))
  const joined = sanitize(tokens.join(''))
  const firstTwo = sanitize(tokens.slice(0, 2).join(''))
  const first = sanitize(tokens[0])
  const bases: string[] = []
  const add = (b: string) => { if (b.length >= 3 && b.length <= 40 && !bases.includes(b)) bases.push(b) }
  add(joined)
  add(keepAll)
  add(firstTwo)
  if (first.length >= 5) add(first)
  const org = /\b(foundation|association|society|institute|church|ministries|services|council|alliance|united way|hospital|health|clinic)\b/.test(full)
  const edu = /\b(university|college|school|academy)\b/.test(full)
  const tlds = edu ? ['edu', 'com'] : org ? ['org', 'com'] : ['com']
  const out: string[] = []
  for (const tld of tlds) for (const b of bases) out.push(`${b}.${tld}`)
  return out
}

const PARKED = /domain (?:is )?for sale|buy this domain|this domain (?:may be|is) for sale|parked (?:free|domain)|sedo\.com|hugedomains|afternic|dan\.com|godaddy\.com\/domains|domain has expired|coming soon|under construction|website is for sale/i

export function looksParked(html: string): boolean {
  return PARKED.test(html.slice(0, 20_000))
}

/** The text a page uses to say who it is: title, site name and application name, and the first heading. Lower case. */
export function selfDescription(html: string): string {
  const head = html.slice(0, 60_000)
  const bits: string[] = []
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1]
  if (title) bits.push(title)
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0]
    if (/(?:property|name)\s*=\s*["'](?:og:site_name|application-name|og:title|twitter:title)["']/i.test(tag)) {
      const c = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]
      if (c) bits.push(c)
    }
  }
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(head)?.[1]
  if (h1) bits.push(h1.replace(/<[^>]+>/g, ' '))
  return bits.join(' ').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;|’/g, '').toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Whether the page is this company's. Every identifying word of the name must appear in how the page describes itself; a one-word name must
 * appear as a whole word. A parked or for-sale page never matches.
 */
export function pageMatchesCompany(name: string, html: string): boolean {
  if (looksParked(html)) return false
  const tokens = nameTokens(name)
  if (tokens.length === 0) return false
  const text = ' ' + selfDescription(html).replace(/[^a-z0-9&]+/g, ' ') + ' '
  // Whole words only ("intel" is not in "intellicorp"), or the whole name run together ("wellsfargo") as one word.
  return tokens.every((t) => text.includes(` ${t} `)) || (tokens.length > 1 && text.includes(` ${tokens.join('')} `))
}

// A site on file for a company is sometimes one of its products or departments ("aws.amazon.com", "labs.google"), which is not how the company
// looks. These leading words mark such a subdomain; the company's own home page is the address without it.
const PRODUCT_PREFIX = new Set(['labs', 'aws', 'cloud', 'developers', 'developer', 'dev', 'careers', 'jobs', 'about', 'investors', 'investor', 'ir', 'news', 'newsroom', 'blog', 'shop', 'store', 'support', 'help', 'docs', 'research', 'appexchange', 'apps', 'app', 'login', 'my', 'portal'])

const COMMON_TLD = new Set(['com', 'org', 'net', 'edu', 'gov', 'io', 'co', 'us', 'biz', 'info', 'ai', 'app', 'dev'])

/** The company's own home page for an address that may be one of its products: "aws.amazon.com" gives "amazon.com"; "labs.google" gives nothing. */
export function companyHomeOf(raw: string | null | undefined): string | null {
  const home = homeUrlOf(raw)
  if (!home) return null
  const u = new URL(home)
  const labels = u.hostname.replace(/^www\./, '').split('.')
  if (labels.length >= 3 && PRODUCT_PREFIX.has(labels[0])) return `${u.protocol}//${labels.slice(1).join('.')}`
  // Two words, the first a product word: "jobs.com" is a company's own address, but "labs.google" is a product on a brand's own top-level
  // domain, with no company home page to go to; a guess from the name will do better.
  if (labels.length === 2 && PRODUCT_PREFIX.has(labels[0]) && !COMMON_TLD.has(labels[1])) return null
  return `${u.protocol}//${labels.join('.')}`
}

/** An address on file, as a clean https home page, or null. */
export function homeUrlOf(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim()
  if (!t) return null
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`)
    if (!u.hostname.includes('.')) return null
    return `${u.protocol}//${u.hostname}`
  } catch {
    return null
  }
}
