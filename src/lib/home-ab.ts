import { classifyUserAgent } from '@/lib/http/user-agent'

// Homepage test: the control page against a variant whose hero is the journey picker's first question.
//
// How it works. The homepage stays a cached page. src/proxy.ts decides, per request, which cached page to serve at "/":
// a human visitor with no account is assigned once (a cookie, no personal data), and the variant is served by REWRITING
// "/" to /ab/home-b, so the address, the canonical link and the cache all stay as they were and nobody sees a flash of the
// other version. Bots and crawlers, people with a session, and everyone when the kill switch is on always get the control
// and are never given the cookie, so search engines only ever see the page they see today.
//
// Kill switch: set HOME_AB=off in Vercel (production) and redeploy. Everyone then gets the control, even people who already
// hold a variant cookie. Unset or any other value: the test runs.
//
// Measurement without a schema change: the visit beacon (src/app/api/track/homepage-visit/route.ts) stamps each homepage
// PAGE_VIEW of an assigned visitor with HOME_AB_STAMP_PREFIX + variant in the otherwise unused `href` column, and the admin
// funnel page joins on the visitor's IP (src/lib/admin/funnel.ts). The path stays "/", so every existing report is unchanged.

export const HOME_AB_COOKIE = 'nc_ab_home'
export const HOME_AB_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
/** The variant page's address: a top-level folder, listed in src/lib/app-top-level.ts. Never linked, never indexed. */
export const HOME_AB_VARIANT_PATH = '/ab/home-b'
export const HOME_AB_STAMP_PREFIX = 'ab:home:'

export type HomeVariant = 'a' | 'b'

export const homeAbOn = (value: string | undefined = process.env.HOME_AB): boolean => (value ?? '').trim().toLowerCase() !== 'off'

export function readHomeVariant(raw: string | undefined | null): HomeVariant | null {
  return raw === 'a' || raw === 'b' ? raw : null
}

export interface HomeVariantDecision {
  variant: HomeVariant
  /** True when the visitor has just been assigned and needs the cookie. */
  assign: boolean
}

/**
 * Which homepage this request gets. Control ('a') without a cookie for the kill switch, a signed-in session, and anything
 * that is not clearly a person's browser; otherwise the cookie's variant, or a new 50/50 assignment.
 */
export function decideHomeVariant(input: {
  cookie: string | undefined | null
  userAgent: string | null
  enabled?: boolean
  hasSession?: boolean
  random?: () => number
}): HomeVariantDecision {
  const { cookie, userAgent, enabled = homeAbOn(), hasSession = false, random = Math.random } = input
  if (!enabled || hasSession || classifyUserAgent(userAgent) !== 'human') return { variant: 'a', assign: false }
  const existing = readHomeVariant(cookie)
  if (existing) return { variant: existing, assign: false }
  return { variant: random() < 0.5 ? 'a' : 'b', assign: true }
}

/** The stamp a homepage view carries, or null when the visitor is not in the test. */
export function homeAbStamp(cookie: string | undefined | null, enabled: boolean = homeAbOn()): string | null {
  const v = readHomeVariant(cookie)
  return enabled && v ? `${HOME_AB_STAMP_PREFIX}${v}` : null
}

/** Whether a stored path is the homepage (with or without a query string). */
export const isHomePath = (path: string | null | undefined): boolean => !!path && path.split('?')[0] === '/'

/**
 * Visitors each arm needs to see a lift in a rate from p0 to p0 x (1 + lift) with 80% power at 5% significance
 * (two-sided, two proportions). A plain planning figure, not a verdict.
 */
export function visitorsPerArm(p0: number, lift = 1): number {
  const p1 = Math.min(0.99, p0 * (1 + lift))
  const delta = p1 - p0
  if (!(p0 > 0) || !(delta > 0)) return Infinity
  return Math.ceil((7.85 * (p0 * (1 - p0) + p1 * (1 - p1))) / (delta * delta))
}
