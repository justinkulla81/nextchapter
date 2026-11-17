// Connected employer job boards, pure parts: reading a pasted link into a provider and board name, keeping the jobs near the region, and
// working out what to add and what to take down. No database and no network here.

export const FEED_PROVIDERS = [
  { key: 'GREENHOUSE', label: 'Greenhouse' },
  { key: 'LEVER', label: 'Lever' },
  { key: 'ASHBY', label: 'Ashby' },
] as const
export type FeedProvider = (typeof FEED_PROVIDERS)[number]['key']
export const providerLabel = (k: string) => FEED_PROVIDERS.find((p) => p.key === k)?.label ?? k

export const MAX_FEEDS = 25
/** Jobs kept from one board in one refresh. A board with more matches keeps the first ones the board lists. */
export const MAX_PER_BOARD = 50

export const feedTag = (feedId: string) => `feed:${feedId}`
export const feedIdFromTag = (tag: string | null | undefined) => (tag?.startsWith('feed:') ? tag.slice(5) : null)

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/

/**
 * A pasted career-site link into the board it names. Reads boards.greenhouse.io/<board>, job-boards.greenhouse.io/<board>,
 * jobs.lever.co/<board> and jobs.ashbyhq.com/<board>. Anything else (Workday, iCIMS, a company's own site) is not readable here yet.
 */
export function parseBoardLink(input: string): { provider: FeedProvider; token: string } | { error: string } {
  const raw = input.trim()
  if (!raw) return { error: 'Paste the link to the employer’s job board.' }
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return { error: 'That does not look like a link. Paste the address of the employer’s job board.' }
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  const first = u.pathname.split('/').filter(Boolean)[0] ?? ''
  const provider: FeedProvider | null =
    host === 'boards.greenhouse.io' || host === 'job-boards.greenhouse.io' || host === 'job-boards.eu.greenhouse.io'
      ? 'GREENHOUSE'
      : host === 'jobs.lever.co'
        ? 'LEVER'
        : host === 'jobs.ashbyhq.com'
          ? 'ASHBY'
          : null
  if (!provider) return { error: 'We can read Greenhouse, Lever and Ashby boards today. For another system, paste the jobs under “Add listings from elsewhere”.' }
  if (!first || !TOKEN.test(first)) return { error: 'The link needs the employer’s board name, such as boards.greenhouse.io/acme.' }
  return { provider, token: first.toLowerCase() }
}

/** "acme-health" → "Acme Health": the starting point for the employer name field, which the person can change. */
export const nameFromToken = (token: string) => token.replace(/[-_.]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()

export type BoardJob = { title: string; location: string | null; url: string; salaryMin?: number | null; salaryMax?: number | null }

const REMOTE = /\bremote\b/i

/** Keep the jobs in the region: location contains the filter text, or (optionally) says remote. An empty filter keeps every job. */
export function keepNear(jobs: BoardJob[], filter: string | null, includeRemote: boolean): BoardJob[] {
  const f = (filter ?? '').trim().toLowerCase()
  const kept = f ? jobs.filter((j) => (j.location ?? '').toLowerCase().includes(f) || (includeRemote && REMOTE.test(j.location ?? ''))) : jobs
  return kept.filter((j) => j.title.trim() && /^https?:\/\//i.test(j.url))
}

/**
 * What a refresh does. `onBoard` is what the board lists now (already filtered); `known` is the feed's current listings (url + id);
 * `elsewhere` is the set of links already on NextChapter from some other source. Add the new ones (up to the cap), take down the
 * feed's listings that left the board.
 */
export function planRefresh(onBoard: BoardJob[], known: { id: string; url: string }[], elsewhere: Set<string>) {
  const seen = new Set<string>()
  const unique = onBoard.filter((j) => (seen.has(j.url) ? false : (seen.add(j.url), true)))
  const knownUrls = new Set(known.map((k) => k.url))
  const room = Math.max(0, MAX_PER_BOARD - known.filter((k) => seen.has(k.url)).length)
  const toAdd = unique.filter((j) => !knownUrls.has(j.url) && !elsewhere.has(j.url)).slice(0, room)
  const toArchive = known.filter((k) => !seen.has(k.url)).map((k) => k.id)
  return { toAdd, toArchive, alreadyElsewhere: unique.filter((j) => !knownUrls.has(j.url) && elsewhere.has(j.url)).length, matched: unique.length }
}
