// Partner portals on their own subdomains, like admin. and workforce.:
//   recruiter.<site>      the recruiter portal       (served from /recruiters)
//   coach.<site>          the coach portal           (/support/coach)
//   employer.<site>       hiring (/talent), and outplacement, growth and
//                         learning (/employer, one employer account).
//                         Was organization.<site>, which now forwards here.
//   candidate.<site>      the job seeker's app       (/dashboard, /onboarding, ...)
// Cookies there are host-only, so each portal's session never shares a
// cookie jar with the main site. Each is switched on by name in
// NEXT_PUBLIC_PORTAL_SUBDOMAINS (comma list) once Supabase allows its
// redirect URL; off, the portal stays at its path on the main site.
// College and workforce portals: src/lib/org-hosts.ts.
// No server-only imports: the proxy and client components read this too.

import type { PortalKey } from '@/lib/supabase/portal'

export type PortalHost = 'recruiter' | 'coach' | 'employer' | 'candidate'

const ON = new Set(
  (process.env.NEXT_PUBLIC_PORTAL_SUBDOMAINS || '')
    .split(',')
    .map((s) => s.trim())
    // 'organization' is the employer host's old name.
    .map((s) => (s === 'organization' ? 'employer' : s))
    .filter(Boolean)
)
export const portalHostOn = (h: PortalHost) => ON.has(h)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
export function portalOrigin(h: PortalHost): string {
  const u = new URL(APP_URL)
  return `${u.protocol}//${h}.${u.host}`
}

// The employer portal's first name; its links forward to employer.<site>.
export const LEGACY_EMPLOYER_HOST_PREFIX = 'organization.'

export function portalHostFor(host: string | null | undefined): PortalHost | null {
  if (!host) return null
  for (const h of ['recruiter', 'coach', 'employer', 'candidate'] as const) if (host.startsWith(`${h}.`)) return h
  return null
}

// A mount: public path `at` on the portal host serves app path `path`;
// `index` is what the bare `at` shows when the app's own root is a public page.
export type Mount = { at: string; path: string; cookie?: PortalKey; index?: string }

export type HostConfig = {
  mounts: Mount[]
  // What the portal host's own root shows.
  home: string
  // App paths under a mount that stay on the main site (public marketing).
  mainExact: string[]
}

// The candidate app's own top-level paths (everything else on the main
// site is public: marketing, reports, partner portals).
export const CANDIDATE_PATHS = ['/dashboard', '/onboarding', '/membership', '/auth/login', '/auth/signup', '/auth/forgot-password', '/auth/reset-password', '/auth/magic-link', '/in', '/claim-reference']

export const HOSTS: Record<PortalHost, HostConfig> = {
  recruiter: { mounts: [{ at: '', path: '/recruiters', cookie: 'recruiter' }], home: '/recruiters/dashboard', mainExact: ['/recruiters'] },
  coach: { mounts: [{ at: '', path: '/support/coach', cookie: 'coach' }], home: '/support/coach', mainExact: [] },
  employer: {
    mounts: [
      { at: '/hiring', path: '/talent', cookie: 'talent', index: '/talent/dashboard' },
      // Before /outplacement: publicPathFor takes the first mount that fits.
      { at: '/growth', path: '/employer/growth', cookie: 'employer' },
      { at: '/learning', path: '/employer/learning', cookie: 'employer' },
      { at: '/outplacement', path: '/employer', cookie: 'employer' },
    ],
    home: '/employer-home',
    mainExact: ['/talent'],
  },
  candidate: { mounts: CANDIDATE_PATHS.map((p) => ({ at: p, path: p })), home: '/dashboard', mainExact: [] },
}

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`)

// A college or workforce org's job-seeker pages (join, welcome, layoff
// sign-up...): they sign a member in, so they go with the candidate app.
export const CANDIDATE_ORG_PAGES = /^\/i\/[a-z0-9-]+\/(join|welcome|rapid|checkin|unsubscribe|give|mentor)(\/|$)/

// Which switched-on portal host serves this app path (null = the main site).
export function hostForAppPath(path: string): PortalHost | null {
  if (portalHostOn('candidate') && CANDIDATE_ORG_PAGES.test(path)) return 'candidate'
  for (const h of Object.keys(HOSTS) as PortalHost[]) {
    if (!portalHostOn(h)) continue
    const c = HOSTS[h]
    if (c.mainExact.includes(path)) continue
    if (c.mounts.some((m) => under(path, m.path))) return h
  }
  return null
}

// '/talent/roles' on organization → '/hiring/roles'; '/recruiters/search' → '/search'.
export function publicPathFor(h: PortalHost, appPath: string): string {
  const m = HOSTS[h].mounts.find((x) => under(appPath, x.path))
  if (!m) return appPath
  const rest = appPath.slice(m.path.length)
  return `${m.at}${rest}` || '/'
}

// The reverse: what a public path on the portal host serves, and with which cookie.
export function appPathFor(h: PortalHost, publicPath: string): { path: string; cookie?: PortalKey } | null {
  const c = HOSTS[h]
  // Mounts with an `at` first (most specific), then a root mount.
  const ordered = [...c.mounts].sort((a, b) => b.at.length - a.at.length)
  for (const m of ordered) {
    if (m.at && publicPath === m.at && m.index) return { path: m.index, cookie: m.cookie }
    if (m.at && under(publicPath, m.at)) return { path: `${m.path}${publicPath.slice(m.at.length)}`, cookie: m.cookie }
    if (!m.at) return { path: `${m.path}${publicPath === '/' ? '' : publicPath}`, cookie: m.cookie }
  }
  return null
}

// The cookie for an app path already in mount form ('/recruiters/...').
export function cookieForAppPath(h: PortalHost, appPath: string): PortalKey | undefined {
  return HOSTS[h].mounts.find((m) => under(appPath, m.path))?.cookie
}

// Full address for an app path: its portal host when that's on, else the main site.
export function urlForAppPath(appPath: string): string {
  const h = hostForAppPath(appPath)
  return h ? `${portalOrigin(h)}${publicPathFor(h, appPath)}` : `${new URL(APP_URL).origin}${appPath}`
}

// Where an emailed sign-in link should come back to, so the session lands in
// that portal's own cookie jar.
export function callbackOriginForAppPath(appPath: string): string {
  const h = hostForAppPath(appPath)
  return h ? portalOrigin(h) : new URL(APP_URL).origin
}
