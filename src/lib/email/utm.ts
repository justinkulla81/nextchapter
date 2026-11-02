// UTM tags for links in the emails we send, so a visit from an email shows up as Email in PostHog instead of Direct.
// Pure and client-safe: the shared Button and the tracked-link redirects both use it.
//
// Only our own site is tagged, and only a link that has no utm_source yet (lifecycle, nurture and outreach links already
// carry theirs). A link that carries a sign-in or confirmation secret is left exactly as built.

const SITE_HOSTS = new Set(['launchyournextchapter.com', 'www.launchyournextchapter.com'])
const SECRET_PARAMS = ['token', 'code', 'access_token', 'refresh_token', 'otp', 'sig', 'signature', 'magic', 'key']
const SKIP_PATHS = ['/api/', '/auth/', '/unsubscribe', '/confirm', '/accept', '/reset']

export const EMAIL_UTM_MEDIUM = 'email'
export const EMAIL_UTM_SOURCE = 'email'

/** A lowercase, URL-safe campaign name from an email key such as FINISH_LINE or "Job Search Daily". */
export function emailCampaign(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'unlabeled'
}

/** `href` with utm_source=email, utm_medium=email and utm_campaign added, or `href` unchanged when it should not be tagged. */
export function withEmailUtm(href: string, campaign: string, extraHosts: string[] = []): string {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return href
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return href
  const host = url.hostname.toLowerCase()
  if (!SITE_HOSTS.has(host) && !extraHosts.includes(host)) return href
  if (url.searchParams.has('utm_source')) return href
  const path = url.pathname.toLowerCase()
  if (SKIP_PATHS.some((p) => path.startsWith(p))) return href
  for (const name of url.searchParams.keys()) {
    if (SECRET_PARAMS.includes(name.toLowerCase())) return href
  }
  url.searchParams.set('utm_source', EMAIL_UTM_SOURCE)
  url.searchParams.set('utm_medium', EMAIL_UTM_MEDIUM)
  url.searchParams.set('utm_campaign', emailCampaign(campaign))
  return url.toString()
}
