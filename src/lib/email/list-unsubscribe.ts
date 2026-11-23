/**
 * RFC 8058 one-click unsubscribe for every email the site sends (owner, 2026-11-23: mail to candidates, the report and layoff
 * emails was landing in spam). Gmail and Yahoo expect bulk mail to carry `List-Unsubscribe` with an https URL and
 * `List-Unsubscribe-Post: List-Unsubscribe=One-Click`; without it Gmail offers "Report spam" where an Unsubscribe button would be.
 *
 * Most senders put an unsubscribe link in the body but no header. `withOneClickUnsubscribe` (applied in createResend) finds
 * that link, maps it to an address that takes the one-click POST, and sets both headers. A sender's own header is kept, and
 * gets the Post header when its URL takes the POST.
 */

/** Unsubscribe addresses whose POST performs the opt-out, keyed by path. */
const ONE_CLICK_PATHS: RegExp[] = [
  /^\/api\/unsubscribe\/(?:lead|intake|newsletter)\/[^/?#]+$/,
  /^\/api\/unsubscribe\/audience\/[^/?#]+\/[^/?#]+$/,
  /^\/api\/unsubscribe\/[^/?#]+$/, // a member's signed link (candidateId)
  /^\/api\/mailing\/unsubscribe\/[^/?#]+$/,
  /^\/api\/higher-ed\/unsubscribe\/[^/?#]+$/,
]

/** The one-click address for an unsubscribe link, or null when the link has none. */
export function oneClickUrl(raw: string): string | null {
  let u: URL
  try {
    u = new URL(raw.replace(/&amp;/g, '&'))
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  // The list-email page (a form) has a one-click twin under /api/mailing/unsubscribe.
  const page = u.pathname.match(/^\/updates\/unsubscribe\/([^/?#]+)$/)
  if (page) {
    u.pathname = `/api/mailing/unsubscribe/${page[1]}`
    u.search = ''
  }
  // A "send me fewer" choice is not an opt-out.
  if (u.searchParams.has('fewer')) return null
  return ONE_CLICK_PATHS.some((re) => re.test(u.pathname)) ? u.toString() : null
}

const URL_IN_BODY = /https?:\/\/[^\s"'<>()]+/g

/** The first link in an email body that has a one-click address. */
export function findUnsubscribeUrl(body: string): string | null {
  for (const m of body.matchAll(URL_IN_BODY)) {
    if (!/unsubscribe/i.test(m[0])) continue
    const url = oneClickUrl(m[0])
    if (url) return url
  }
  return null
}

type Headers = Record<string, string>

function headerKey(headers: Headers, name: string): string | undefined {
  return Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
}

/** Headers with one-click unsubscribe added where the email has a link that takes it; unchanged otherwise. */
export function withOneClickUnsubscribe(headers: Headers | undefined, body: string | null): Headers | undefined {
  const h = { ...(headers ?? {}) }
  if (headerKey(h, 'List-Unsubscribe-Post')) return headers
  const listKey = headerKey(h, 'List-Unsubscribe')
  if (listKey) {
    // Keep every mailto: part; swap the https part for its one-click address when it has one.
    const parts = h[listKey].split(',').map((p) => p.trim()).filter(Boolean)
    let oneClick = false
    const next = parts.map((p) => {
      const inner = p.replace(/^<|>$/g, '')
      if (!/^https?:/i.test(inner)) return p
      const url = oneClickUrl(inner)
      if (!url) return p
      oneClick = true
      return `<${url}>`
    })
    if (!oneClick) return headers
    return { ...h, [listKey]: next.join(', '), 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
  }
  const url = body ? findUnsubscribeUrl(body) : null
  if (!url) return headers
  return { ...h, 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
}
