// Every non-candidate portal gets its own independent Supabase Auth session,
// scoped by cookie name (see client.ts/server.ts's `portal` param) — so being
// authenticated in one portal never grants or implies access in another. The
// candidate portal deliberately keeps the default/unscoped cookie (no entry
// here), so no real candidate is forced to re-log-in by this change. See
// src/lib/auth/switch-role.ts's own comment for the spec this implements
// ("Partners Master Build Script §A1.2.1" — separate sessions, explicit
// re-auth, persistent context banner).
export type PortalKey = 'recruiter' | 'coach' | 'talent' | 'employer' | 'nen' | 'eqoveriq' | 'admin'

export const PORTAL_COOKIE_NAMES: Record<PortalKey, string> = {
  recruiter: 'sb-recruiter-auth-token',
  coach: 'sb-coach-auth-token',
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
  ['/talent', 'talent'],
  ['/employer', 'employer'],
  ['/noexperience/employers', 'nen'],
  ['/eqoveriq/contributors', 'eqoveriq'],
]

// Boundary-aware — plain startsWith would treat '/employer' as a match for
// the unrelated '/employers' marketing page too (a real bug this fixed:
// see middleware.ts's own former copy of this same function, before it
// was extracted here — production incident notes live there).
export function pathStartsWith(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function portalForPath(pathname: string): PortalKey | undefined {
  return PORTAL_PATH_PREFIXES.find(([prefix]) => pathStartsWith(pathname, prefix))?.[1]
}

// Portals whose bare `/<portal>` path is now a PUBLIC marketing page, not
// the app itself — the real app lives one level deeper (a route-group
// move, same as the earlier Hiring Manager split). Any list that means
// "the private app pages for this portal" — middleware's protectedPaths,
// robots.ts's disallow list, GoogleAnalytics's exclusion list — must
// enumerate these specific subroutes, never the bare portal path, or a
// prefix match silently swallows the public marketing page too. This is
// the single source of truth for that list so the three copies can't
// drift apart the way they already had for /hiring (visiting it
// anonymously redirected straight to /hiring/login instead of showing the
// marketing page, until this was extracted to fix that).
export const PORTAL_APP_SUBROUTES: Partial<Record<PortalKey, string[]>> = {
  talent: [
    '/talent/dashboard',
    '/talent/roles',
    '/talent/candidates',
    '/talent/messages',
    '/talent/saved',
    '/talent/analytics',
    '/talent/job-board',
    '/talent/team',
    '/talent/settings',
  ],
}

// Every authenticated app page across every portal, including the
// candidate one (/dashboard, which has no separate PortalKey since it uses
// the default/unscoped cookie) — the single source of truth for "this is
// app usage, not public marketing traffic." middleware.ts's own
// auth-gate check and HomepageVisitTracker's public-page gate (it fires in
// the root layout now, so it needs to know which paths are someone else's
// job to track) both read this list; keep it here rather than letting a
// second copy of either drift, the exact failure mode PORTAL_APP_SUBROUTES
// above already exists to prevent for a narrower case.
export const PROTECTED_APP_PATH_PREFIXES: string[] = [
  '/dashboard',
  ...PORTAL_APP_SUBROUTES.talent!,
  '/noexperience/employers',
  '/eqoveriq/contributors',
  '/recruiters',
  '/support/coach',
  '/employer',
  '/support/admin',
]
