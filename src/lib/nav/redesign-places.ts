// The redesigned candidate menu (docs/candidate-redesign.md): Home, Jobs, Network, Learn, Finances and
// benefits, Account and privacy, Help. It re-homes the same pages the six-place menu has, so nothing is
// lost, and reuses its tab rules (journey, early career, paid access) and its menu entries. Switched on
// by src/lib/redesign/flag.ts; the live menu (places.ts) is untouched.

import { PLACES, matches, type Place, type PlaceTab } from './places'

export type RedesignKey = 'home' | 'jobs' | 'network' | 'learn' | 'money' | 'account' | 'help'
export interface RedesignPlace extends Omit<Place, 'key'> {
  key: RedesignKey
}

const LEGACY_TABS = new Map<string, PlaceTab>(PLACES.flatMap((p) => p.tabs).map((t) => [t.href, t]))

/** A tab the six-place menu already has, optionally renamed or with extra matching routes. */
function legacy(href: string, over: Partial<PlaceTab> = {}): PlaceTab {
  const t = LEGACY_TABS.get(href)
  if (!t) throw new Error(`No existing tab for ${href}`)
  return { ...t, ...over }
}
const tab = (label: string, href: string, over: Partial<PlaceTab> = {}): PlaceTab => ({ label, href, ...over })

export const REDESIGN_PLACES: RedesignPlace[] = [
  {
    key: 'home',
    label: 'Home',
    href: '/dashboard',
    tabs: [
      legacy('/dashboard', { label: 'Your week' }),
      tab('Improve your search', '/dashboard/improve'),
      legacy('/dashboard/search-strategy', { label: 'Search details', alsoMatches: ['/dashboard/what-i-need', '/dashboard/marketing-plan'] }),
      legacy('/dashboard/stats', { label: 'Effort and results' }),
    ],
    groups: [
      { label: 'Your week', hrefs: ['/dashboard'] },
      { label: 'Improve your search', hrefs: ['/dashboard/improve', '/dashboard/search-strategy'] },
      { label: 'Effort and results', hrefs: ['/dashboard/stats'] },
    ],
    alsoPrefixes: ['/dashboard/checkin', '/dashboard/complete-profile'],
  },
  {
    key: 'jobs',
    label: 'Jobs',
    href: '/dashboard/find-my-job',
    tabs: [
      legacy('/dashboard/find-my-job'),
      legacy('/dashboard/early-career'),
      tab('Résumé', '/dashboard/resume', { alsoMatches: ['/dashboard/linkedin', '/dashboard/portfolio'] }),
      tab('Why hire me', '/dashboard/strengths', { alsoMatches: ['/dashboard/track-record', '/dashboard/how-i-perform'] }),
      legacy('/dashboard/companies'),
      legacy('/dashboard/market'),
      legacy('/dashboard/pay'),
      legacy('/dashboard/local-market'),
      legacy('/dashboard/interview-prep'),
      legacy('/dashboard/review-prep'),
      legacy('/dashboard/alumni-jobs'),
      legacy('/dashboard/got-hired'),
      legacy('/dashboard/in-work'),
      // Sponsored staff programs only (employer seats): reached today only from a card on Home.
      tab('Open roles at your company', '/dashboard/internal-roles', { employedOnly: true }),
    ],
    groups: [
      { label: 'Find a job', hrefs: ['/dashboard/find-my-job', '/dashboard/alumni-jobs', '/dashboard/internal-roles'] },
      { label: 'Early career plan', hrefs: ['/dashboard/early-career'] },
      { label: 'Get ready to apply', hrefs: ['/dashboard/resume', '/dashboard/strengths'] },
      { label: 'Companies', hrefs: ['/dashboard/companies'] },
      { label: 'Market and pay', hrefs: ['/dashboard/market', '/dashboard/pay', '/dashboard/local-market'] },
      { label: 'Interviews and reviews', hrefs: ['/dashboard/interview-prep', '/dashboard/review-prep'] },
      { label: 'Offers and raises', hrefs: ['/dashboard/got-hired', '/dashboard/in-work'] },
    ],
  },
  {
    key: 'network',
    label: 'Network',
    href: '/dashboard/network',
    tabs: [
      legacy('/dashboard/network'),
      legacy('/dashboard/network/contacts'),
      legacy('/dashboard/references'),
      legacy('/dashboard/community'),
      legacy('/dashboard/messages'),
      legacy('/dashboard/supporters'),
      legacy('/dashboard/groups'),
      legacy('/dashboard/my-coaching'),
      legacy('/dashboard/recruiter-requests'),
      tab('What recruiters see', '/dashboard/recruiter-report'),
    ],
    groups: [
      { label: 'This week', hrefs: ['/dashboard/network'] },
      { label: 'Contacts', hrefs: ['/dashboard/network/contacts'] },
      { label: 'Community', hrefs: ['/dashboard/community', '/dashboard/messages', '/dashboard/groups'] },
      { label: 'References and supporters', hrefs: ['/dashboard/references', '/dashboard/supporters'] },
      { label: 'Coaching', hrefs: ['/dashboard/my-coaching'] },
      { label: 'Recruiters', hrefs: ['/dashboard/recruiter-requests', '/dashboard/recruiter-report'] },
    ],
  },
  {
    key: 'learn',
    label: 'Learn',
    href: '/dashboard/learning',
    tabs: [
      legacy('/dashboard/learning'),
      legacy('/dashboard/webinars'),
      tab('Know yourself', '/dashboard/skills-assessments', { menuKeys: ['assessments'], alsoMatches: ['/dashboard/skills-assessment', '/dashboard/retake-assessment', '/dashboard/work-interests'] }),
      tab('Career story', '/dashboard/my-career'),
      legacy('/dashboard/pivot-paths', { label: 'Other roles you could do' }),
      tab('Courses your company covers', '/dashboard/company-courses', { employedOnly: true }),
    ],
    groups: [
      { label: 'Learn new skills', hrefs: ['/dashboard/learning', '/dashboard/webinars', '/dashboard/company-courses'] },
      { label: 'Know yourself', hrefs: ['/dashboard/skills-assessments'] },
      { label: 'Your path', hrefs: ['/dashboard/my-career', '/dashboard/pivot-paths'] },
    ],
  },
  {
    // Shown only to members who chose money help (profile.moneyHelp). For every journey.
    key: 'money',
    label: 'Finances and benefits',
    href: '/dashboard/benefits',
    tabs: [tab('Benefits and deadlines', '/dashboard/benefits', { alsoMatches: ['/dashboard/benefits-network'] })],
    groups: [{ label: 'Benefits and deadlines', hrefs: ['/dashboard/benefits'] }],
  },
  {
    key: 'account',
    label: 'Account and privacy',
    href: '/dashboard/profile',
    tabs: [
      legacy('/dashboard/profile', { label: 'Profile' }),
      tab('Privacy', '/dashboard/privacy'),
      legacy('/dashboard/documents'),
      tab('Money help', '/dashboard/money-help'),
      legacy('/dashboard/membership'),
    ],
    groups: [
      { label: 'Profile', hrefs: ['/dashboard/profile'] },
      { label: 'Privacy', hrefs: ['/dashboard/privacy'] },
      { label: 'Documents', hrefs: ['/dashboard/documents'] },
      { label: 'Money help', hrefs: ['/dashboard/money-help'] },
      { label: 'Membership', hrefs: ['/dashboard/membership'] },
    ],
  },
  {
    key: 'help',
    label: 'Help',
    href: '/dashboard/support',
    tabs: [legacy('/dashboard/support'), tab('Scam watch', '/dashboard/scam-watch'), legacy('/dashboard/help')],
    groups: [
      { label: 'Talk to someone', hrefs: ['/dashboard/support'] },
      { label: 'Scam watch', hrefs: ['/dashboard/scam-watch'] },
      { label: 'Questions and feedback', hrefs: ['/dashboard/help'] },
    ],
  },
]

/** Places a member can see: Finances and benefits only when they chose money help. */
export function redesignPlacesFor(opts: { moneyHelp: boolean | null }): RedesignPlace[] {
  return REDESIGN_PLACES.filter((p) => p.key !== 'money' || opts.moneyHelp !== false)
}

/** The place a pathname belongs to. The longest matching route wins. */
export function redesignPlaceForPath(pathname: string, places: RedesignPlace[] = REDESIGN_PLACES): RedesignPlace | null {
  let best: { place: RedesignPlace; len: number } | null = null
  for (const place of places) {
    const hrefs = [...place.tabs.flatMap((t) => [t.href, ...(t.alsoMatches ?? [])]), ...(place.alsoPrefixes ?? [])]
    for (const h of hrefs) {
      if (matches(pathname, h) && (!best || h.length > best.len)) best = { place, len: h.length }
    }
  }
  return best?.place ?? null
}
