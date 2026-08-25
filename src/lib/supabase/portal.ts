// Every non-candidate portal gets its own independent Supabase Auth session,
// scoped by cookie name (see client.ts/server.ts's `portal` param) — so being
// authenticated in one portal never grants or implies access in another. The
// candidate portal deliberately keeps the default/unscoped cookie (no entry
// here), so no real candidate is forced to re-log-in by this change. See
// src/lib/auth/switch-role.ts's own comment for the spec this implements
// ("Partners Master Build Script §A1.2.1" — separate sessions, explicit
// re-auth, persistent context banner).
export type PortalKey = 'recruiter' | 'coach' | 'hiring' | 'talent' | 'employer' | 'nen' | 'eqoveriq' | 'admin'

export const PORTAL_COOKIE_NAMES: Record<PortalKey, string> = {
  recruiter: 'sb-recruiter-auth-token',
  coach: 'sb-coach-auth-token',
  hiring: 'sb-hiring-auth-token',
  talent: 'sb-talent-auth-token',
  employer: 'sb-employer-auth-token', // outplacement-buyer portal, distinct from Talent
  nen: 'sb-nen-employer-auth-token',
  eqoveriq: 'sb-eqoveriq-auth-token',
  admin: 'sb-admin-auth-token',
}

// Longer/more specific prefixes first so a shorter one never shadows a more
// specific match — none of these actually overlap today, but keep the
// specific ones listed first regardless, for whenever a new portal is added.
export const PORTAL_PATH_PREFIXES: [string, PortalKey][] = [
  ['/support/coach', 'coach'],
  ['/support/admin', 'admin'],
  ['/recruiters', 'recruiter'],
  ['/hiring', 'hiring'],
  ['/talent', 'talent'],
  ['/employer', 'employer'],
  ['/noexperience/employers', 'nen'],
  ['/eqoveriq/contributors', 'eqoveriq'],
]

export function portalForPath(pathname: string): PortalKey | undefined {
  return PORTAL_PATH_PREFIXES.find(([prefix]) => pathname.startsWith(prefix))?.[1]
}
