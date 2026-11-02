// Pure text helpers for the news@ sweep, kept apart from the Gmail and database code so they can be tested alone.

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi
const SKIP_HOSTS = ['google.com', 'gmail.com', 'googleusercontent.com', 'launchyournextchapter.com', 'mailto']
const SKIP_PATH = /unsubscribe|optout|opt-out|manage[-_]?preferences|\/privacy|\/terms/i

/** Links in an email body that point at an article: tracking parameters removed, housekeeping and our own site dropped, each address once. */
export function extractNewsLinks(text: string, clean: (url: string) => string | null): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.match(URL_PATTERN) ?? []) {
    const trimmed = raw.replace(/[.,;:!?]+$/, '')
    const url = clean(trimmed)
    if (!url) continue
    let host: string
    try {
      host = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      continue
    }
    if (SKIP_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) || SKIP_PATH.test(url)) continue
    if (seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

/** What Justin wrote before the first link (his comment on the story), without forwarding headers. */
export function noteBeforeFirstLink(text: string): string | null {
  const first = text.search(URL_PATTERN)
  const head = (first === -1 ? text : text.slice(0, first))
    .split('\n')
    .filter((l) => !/^\s*(-{2,}|>|from:|to:|date:|subject:|cc:|begin forwarded)/i.test(l))
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim()
  return head ? head.slice(0, 500) : null
}

/** The router must be at least this sure before a story goes live without Justin. */
export const AUTO_PUBLISH_MIN_CONFIDENCE = 0.85
/** Of the last few stories published this way, no more than this many may be negative: News should not be only bad news. */
export const AUTO_PUBLISH_RECENT = 5
export const AUTO_PUBLISH_MAX_RECENT_NEGATIVE = 2

export type NewsTone = 'positive' | 'neutral' | 'negative'

export interface AutoPublishInput {
  website: boolean
  political: boolean
  tone: NewsTone
  credibilityTier: 'recognized' | 'unknown'
  confidenceScore: number
  hasTitle: boolean
}

/**
 * Whether a story the router sent to website News may go live without Justin.
 * Only a confident, credible, non-political one; and a negative one only while
 * the most recent auto-published stories (newest first) are not mostly negative.
 */
export function canAutoPublish(r: AutoPublishInput, recentTones: NewsTone[]): boolean {
  if (!r.website || r.political || !r.hasTitle) return false
  if (r.credibilityTier !== 'recognized' || r.confidenceScore < AUTO_PUBLISH_MIN_CONFIDENCE) return false
  if (r.tone === 'negative') {
    const negatives = recentTones.slice(0, AUTO_PUBLISH_RECENT).filter((t) => t === 'negative').length
    if (negatives >= AUTO_PUBLISH_MAX_RECENT_NEGATIVE) return false
  }
  return true
}
