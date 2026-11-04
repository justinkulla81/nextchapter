import { MAIN_SITE_SEGMENTS } from '@/lib/org-hosts'

// What kind of page a row in the visit log (Admin > Visitors > Activity) is, so the log tells public browsing apart
// from people signing in and from the business-buyer (B2B) side of the site.
export type VisitPageType =
  | 'Homepage'
  | 'Job posting'
  | 'Public page'
  | 'Candidate sign-up'
  | 'Candidate login'
  | 'Candidate portal'
  | 'B2B public page'
  | 'B2B login'
  | 'B2B portal'

// Pages written for buyers: employers, colleges, workforce boards, economic development, coaches, recruiters, and
// the organization directories that go with them. A section counts with everything under it.
const B2B_PUBLIC_SECTIONS = [
  '/for-organizations',
  '/for-colleges',
  '/for-rapid-response',
  '/for-coaches',
  '/government-workforce',
  '/higher-education',
  '/nonprofits',
  '/outplacement',
  '/workforce-boards',
  '/economic-development',
  '/rapid-response',
  '/associations',
  '/systems',
  '/employer-home',
  '/rfp-template',
  '/demo',
]
// Only the page itself is for buyers; what sits under it is for job seekers (/employers/<company> is a company page).
const B2B_PUBLIC_EXACT = new Set(['/employers', '/employees', '/pricing', '/coaches', '/talent', '/recruiters'])

// Sign-in pages of the partner portals, at their path on the main site and, for /login and the like, at the root of a
// portal's own host (recruiter., coach., employer., a college or workforce host).
const B2B_LOGIN_PAGE =
  /^\/(?:(?:recruiters|talent|employer|support\/coach|noexperience\/employers|eqoveriq\/contributors)\/(?:login|signup|forgot-password|invite|seats|start|access|google)|login|signup|forgot-password)(?:\/|$)/
export const B2B_PORTAL_SECTIONS = ['/recruiters', '/talent', '/employer', '/support/coach', '/noexperience/employers', '/eqoveriq/contributors', '/hiring', '/growth', '/learning']

const CANDIDATE_LOGIN_SECTIONS = ['/auth', '/claim-reference']
export const CANDIDATE_PORTAL_SECTIONS = ['/dashboard', '/alumni-plan', '/membership', '/checkin', '/in']

const under = (path: string, section: string) => path === section || path.startsWith(`${section}/`)

export function classifyVisitPage(path: string | null): VisitPageType {
  const raw = (path ?? '').replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0] || '/'
  const p = raw.length > 1 ? raw.replace(/\/+$/, '').toLowerCase() : raw

  if (p === '/') return 'Homepage'
  if (/^\/jobs\/[^/]+/.test(p)) return 'Job posting'

  if (CANDIDATE_LOGIN_SECTIONS.some((s) => under(p, s))) return 'Candidate login'
  if (under(p, '/onboarding')) return 'Candidate sign-up'
  if (CANDIDATE_PORTAL_SECTIONS.some((s) => under(p, s))) return 'Candidate portal'

  // College and workforce portals (/i/<org>/...): the job-seeker pages (join, welcome, check-in...) are public;
  // the rest is the organization's own portal.
  if (under(p, '/i')) {
    const [, , second, third] = p.split('/')
    if (!second || ['login', 'mfa', 'invite'].includes(second)) return 'B2B login'
    if (third && MAIN_SITE_SEGMENTS.has(third)) return third === 'join' || third === 'welcome' ? 'Candidate sign-up' : 'Public page'
    return 'B2B portal'
  }

  if (B2B_PUBLIC_EXACT.has(p)) return 'B2B public page'
  if (B2B_LOGIN_PAGE.test(p)) return 'B2B login'
  if (B2B_PORTAL_SECTIONS.some((s) => under(p, s))) return 'B2B portal'
  if (B2B_PUBLIC_SECTIONS.some((s) => under(p, s))) return 'B2B public page'

  return 'Public page'
}

// Plain grey for ordinary public browsing; the rest stand out so sign-ins and B2B visits are easy to spot.
export function isMutedVisitPageType(t: VisitPageType): boolean {
  return t === 'Public page'
}
