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
