// Imported review stats from other fractional / freelance platforms — the
// pure half (platform list, input checks, robots.txt and page matching), so
// it is tested without the network.

export interface ReviewPlatform {
  key: string
  label: string
  /** Hostnames a public profile lives on (the link must be on one of these). */
  hosts: string[]
  /**
   * Why we never fetch this platform's pages, when we don't: a login wall or
   * bot protection. We never scrape behind a login or work around bot
   * protection; these go straight to the admin review list.
   */
  noFetch?: string
}

export const REVIEW_PLATFORMS: ReviewPlatform[] = [
  { key: 'upwork', label: 'Upwork', hosts: ['upwork.com'], noFetch: 'Upwork profiles sit behind bot protection, so we do not fetch them.' },
  { key: 'toptal', label: 'Toptal', hosts: ['toptal.com'] },
  { key: 'catalant', label: 'Catalant', hosts: ['gocatalant.com', 'catalant.com'] },
  { key: 'contra', label: 'Contra', hosts: ['contra.com'] },
  { key: 'ateam', label: 'A.Team', hosts: ['a.team'] },
  { key: 'fiverr_pro', label: 'Fiverr Pro', hosts: ['fiverr.com'], noFetch: 'Fiverr profiles sit behind bot protection, so we do not fetch them.' },
  { key: 'malt', label: 'Malt', hosts: ['malt.com', 'malt.fr', 'malt.de', 'malt.es', 'malt.co.uk', 'malt.nl', 'malt.be', 'malt.ch'] },
  { key: 'linkedin_services', label: 'LinkedIn services', hosts: ['linkedin.com'], noFetch: 'LinkedIn needs a login to see reviews, so we do not fetch it.' },
  { key: 'other', label: 'Other', hosts: [] },
]

export function platformFor(key: string): ReviewPlatform | undefined {
  return REVIEW_PLATFORMS.find((p) => p.key === key)
}

export function platformLabel(key: string, typed?: string | null): string {
  if (key === 'other') return typed?.trim() || 'Other platform'
  return platformFor(key)?.label ?? key
}

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  SELF_REPORTED: 'Self-reported with link',
  NEEDS_REVIEW: 'Self-reported with link',
  LINK_CHECKED: 'Link checked',
  CONFIRMED: 'Confirmed by NextChapter',
  REJECTED: 'Not confirmed',
}

export function hostMatches(host: string, allowed: string[]): boolean {
  const h = host.toLowerCase().replace(/^www\./, '')
  return allowed.some((a) => h === a || h.endsWith(`.${a}`))
}

export interface ReviewInput {
  platform: string
  platformLabel: string | null
  profileUrl: string
  rating: number
  reviewCount: number
  jobsCompleted: number | null
}

export type ParsedReviewInput = { ok: true; value: ReviewInput } | { ok: false; error: string }

function num(raw: FormDataEntryValue | null): number | null {
  const s = typeof raw === 'string' ? raw.trim().replace(/,/g, '') : ''
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

/** Checks the add-reviews form. Error messages say what to fix. */
export function parseReviewForm(form: FormData): ParsedReviewInput {
  const platform = String(form.get('platform') ?? '')
  const p = platformFor(platform)
  if (!p) return { ok: false, error: 'Choose the platform your reviews are on.' }
  const typed = String(form.get('platformLabel') ?? '').trim().slice(0, 60) || null
  if (platform === 'other' && !typed) return { ok: false, error: 'Type the name of the platform.' }

  const rawUrl = String(form.get('profileUrl') ?? '').trim()
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, error: 'Paste the full link to your public profile, starting with https://.' }
  }
  if (url.protocol !== 'https:') return { ok: false, error: 'The profile link needs to start with https://.' }
  if (p.hosts.length > 0 && !hostMatches(url.hostname, p.hosts)) {
    return { ok: false, error: `That link isn't on ${p.label}. Paste the link to your ${p.label} profile.` }
  }

  const rating = num(form.get('rating'))
  if (rating === null || Number.isNaN(rating) || rating <= 0 || rating > 5) {
    return { ok: false, error: 'Enter your average rating as a number from 1 to 5 (for example 4.9).' }
  }
  const reviewCount = num(form.get('reviewCount'))
  if (reviewCount === null || Number.isNaN(reviewCount) || reviewCount < 1 || !Number.isInteger(reviewCount) || reviewCount > 100000) {
    return { ok: false, error: 'Enter how many reviews you have, as a whole number.' }
  }
  const jobs = num(form.get('jobsCompleted'))
  if (jobs !== null && (Number.isNaN(jobs) || jobs < 0 || !Number.isInteger(jobs) || jobs > 100000)) {
    return { ok: false, error: 'Jobs completed should be a whole number, or leave it blank.' }
  }

  return {
    ok: true,
    value: { platform, platformLabel: platform === 'other' ? typed : null, profileUrl: url.toString(), rating: Math.round(rating * 100) / 100, reviewCount, jobsCompleted: jobs },
  }
}

// ── robots.txt ───────────────────────────────────────────────────────────────

export const CHECK_USER_AGENT = 'NextChapterBot'

/**
 * Is `path` allowed for our user agent under this robots.txt? Standard rules:
 * the most specific group (our agent, else `*`), longest matching rule wins,
 * Allow wins a tie. No robots.txt group means allowed.
 */
export function robotsAllows(robotsTxt: string, path: string, agent = CHECK_USER_AGENT): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; pattern: string }[] }[] = []
  let current: (typeof groups)[number] | null = null
  let lastWasAgent = false
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const field = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
    } else if ((field === 'allow' || field === 'disallow') && current) {
      lastWasAgent = false
      if (field === 'disallow' && value === '') continue
      current.rules.push({ allow: field === 'allow', pattern: value })
    } else {
      lastWasAgent = false
    }
  }
  const ua = agent.toLowerCase()
  const own = groups.filter((g) => g.agents.some((a) => a !== '*' && ua.includes(a)))
  const chosen = own.length > 0 ? own : groups.filter((g) => g.agents.includes('*'))
  const rules = chosen.flatMap((g) => g.rules)
  let best: { allow: boolean; len: number } | null = null
  for (const r of rules) {
    if (!robotsPatternMatches(r.pattern, path)) continue
    const len = r.pattern.length
    if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len }
  }
  return best ? best.allow : true
}

function robotsPatternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$')
  const body = anchored ? pattern.slice(0, -1) : pattern
  const re = new RegExp('^' + body.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anchored ? '$' : ''))
  return re.test(path)
}

// ── Matching the fetched page ────────────────────────────────────────────────

/** Signs the page is a login wall or a bot challenge rather than the profile. */
export function looksBlocked(html: string): boolean {
  return /captcha|cf-chl|challenge-platform|px-captcha|just a moment\.\.\.|access denied|please verify you are a human|sign in to continue|log in to continue/i.test(
    html.slice(0, 200_000)
  )
}

function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export interface PageCheck {
  confirmed: boolean
  note: string
}

/**
 * Does the public page show this person's name and the numbers they gave?
 * Name = first and last name both present. Numbers = the rating (e.g. "4.9")
 * and the review count both appear.
 */
export function matchProfilePage(
  html: string,
  who: { firstName: string | null; lastName: string | null },
  stats: { rating: number; reviewCount: number }
): PageCheck {
  if (looksBlocked(html)) return { confirmed: false, note: 'The page asked for a login or a bot check, so we stopped.' }
  const text = pageText(html)
  const first = who.firstName?.trim().toLowerCase()
  const last = who.lastName?.trim().toLowerCase()
  const nameFound = Boolean(first && text.includes(first) && (!last || text.includes(last) || text.includes(`${last[0]}.`)))
  const ratingStrings = [stats.rating.toFixed(1), stats.rating.toFixed(2), String(stats.rating)]
  const ratingFound = ratingStrings.some((r) => new RegExp(`(^|[^\\d.])${r.replace('.', '\\.')}([^\\d]|$)`).test(text))
  const countFound = new RegExp(`(^|[^\\d,])${stats.reviewCount.toLocaleString('en-US').replace(/,/g, ',?')}([^\\d]|$)`).test(text)
  const missing = [nameFound ? null : 'your name', ratingFound ? null : 'the rating', countFound ? null : 'the review count'].filter(Boolean)
  if (missing.length === 0) return { confirmed: true, note: 'Name, rating and review count all found on the public page.' }
  return { confirmed: false, note: `Public page fetched, but we could not find ${missing.join(', ')} on it.` }
}
