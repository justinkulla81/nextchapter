// A member's login cookie belongs to the candidate host only (candidate.<site>; cookies are host-only so each portal's
// session stays apart, src/lib/portal-hosts.ts), so the main site never sees it. This marker is how the main site
// knows a browser belongs to a member: a flag, not a credential, set on the whole site when the member's session is
// seen on a portal request. It carries nothing a person could log in with, and it is never set from something a visitor
// types (an email typed on a public page would let anyone find out who is a member). The main site uses it to send
// the member into the portal (src/lib/jobs/portal-job-redirect.ts); if their session has expired, they log in once and
// come back to the same page. No server-only imports: the proxy reads this.
import { PORTAL_COOKIE_NAMES } from '@/lib/supabase/portal'

export const MEMBER_MARKER_COOKIE = 'nc_member'
export const MEMBER_MARKER_MAX_AGE_SECONDS = 365 * 24 * 60 * 60

const PORTAL_NAMES = new Set<string>(Object.values(PORTAL_COOKIE_NAMES))

/** A member's session cookie: Supabase's own name (sb-<project>-auth-token, maybe chunked .0 .1), not a partner portal's. */
export function isMemberSessionCookie(name: string): boolean {
  const base = name.replace(/\.\d+$/, '')
  return base.startsWith('sb-') && base.endsWith('auth-token') && !PORTAL_NAMES.has(base)
}

export function memberStatus(cookies: { name: string }[]): { session: boolean; marker: boolean } {
  return { session: cookies.some((c) => isMemberSessionCookie(c.name)), marker: cookies.some((c) => c.name === MEMBER_MARKER_COOKIE) }
}

/** The site's own domain ("launchyournextchapter.com"), so the main site and candidate.<site> share the marker. Undefined on localhost. */
export function markerDomain(appUrl: string | undefined): string | undefined {
  try {
    const host = new URL(appUrl || '').hostname
    return host && host !== 'localhost' && !/^[\d.]+$/.test(host) ? host.replace(/^www\./, '') : undefined
  } catch {
    return undefined
  }
}
