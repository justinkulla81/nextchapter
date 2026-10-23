// The candidate menu (docs/candidate-redesign.md): Home, Jobs, Network, Learn, Finances and
// benefits, Account and privacy, Help. Each tab carries its menu rules (journey, early career, paid
// access); the helpers and menu entries are in places.ts.

import { PREMIUM_HREF, matches, type Place, type PlaceTab } from './places'

export type RedesignKey = 'home' | 'jobs' | 'network' | 'learn' | 'money' | 'account' | 'help'
export interface RedesignPlace extends Place {
  key: RedesignKey
}

const tab = (label: string, href: string, over: Partial<PlaceTab> = {}): PlaceTab => ({ label, href, ...over })

export const REDESIGN_PLACES: RedesignPlace[] = [
  {
    key: 'home',
    label: 'Home',
    href: '/dashboard',
    tabs: [
      tab('Your week', '/dashboard'),
      tab('Improve your search', '/dashboard/improve'),
      tab('Search details', '/dashboard/search-strategy', { menuKeys: ['strategy'], alsoMatches: ['/dashboard/what-i-need', '/dashboard/marketing-plan'] }),
      tab('Effort and results', '/dashboard/stats', { alsoMatches: ['/dashboard/sprint', '/dashboard/plans'] }),
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
      tab('Find a job', '/dashboard/find-my-job', { menuKeys: ['jobs'], alsoMatches: ['/dashboard/job-board', '/dashboard/job-discovery', '/dashboard/job-fit', '/dashboard/interim-work'] }),
      tab('Early career plan', '/dashboard/early-career', { earlyCareerOnly: true }),
      tab('Résumé', '/dashboard/resume', { alsoMatches: ['/dashboard/linkedin', '/dashboard/portfolio'] }),
      tab('Why hire me', '/dashboard/strengths', { alsoMatches: ['/dashboard/track-record', '/dashboard/how-i-perform'] }),
      tab('Companies', '/dashboard/companies', { menuKeys: ['companies'], alsoMatches: ['/dashboard/company-tracker'] }),
      // The one market report (owner, 2026-10-18). The job-market widening page and Market Intelligence stay reachable from it.
      tab('Your market report', '/dashboard/market-reality', { alsoMatches: ['/dashboard/market', '/dashboard/market-intelligence'] }),
      tab('Know your worth', '/dashboard/pay'),
      tab('Local market', '/dashboard/local-market', { menuKeys: ['local'] }),
      tab('Interview prep', '/dashboard/interview-prep', { menuKeys: ['interviewPrep', 'growConversation'] }),
      tab('Build your case', '/dashboard/review-prep', { menuKeys: ['growCase'] }),
      tab('From my groups', '/dashboard/alumni-jobs'),
      tab('Got an offer', '/dashboard/got-hired', { menuKeys: ['offer', 'careerFirst90'] }),
      tab('Reviews and raises', '/dashboard/in-work', { employedOnly: true }),
      // Sponsored staff programs only (employer seats): reached today only from a card on Home.
      tab('Open roles at your company', '/dashboard/internal-roles', { employedOnly: true }),
    ],
    groups: [
      { label: 'Find a job', hrefs: ['/dashboard/find-my-job', '/dashboard/alumni-jobs', '/dashboard/internal-roles'] },
      { label: 'Early career plan', hrefs: ['/dashboard/early-career'] },
      { label: 'Get ready to apply', hrefs: ['/dashboard/resume', '/dashboard/strengths'] },
      { label: 'Companies', hrefs: ['/dashboard/companies'] },
      { label: 'Market and pay', hrefs: ['/dashboard/market-reality', '/dashboard/pay', '/dashboard/local-market'] },
      { label: 'Interviews and reviews', hrefs: ['/dashboard/interview-prep', '/dashboard/review-prep'] },
      { label: 'Offers and raises', hrefs: ['/dashboard/got-hired', '/dashboard/in-work'] },
    ],
  },
  {
    key: 'network',
    label: 'Network',
    href: '/dashboard/network',
    tabs: [
      tab('This week', '/dashboard/network', { menuKeys: ['network', 'careerNetwork'], alsoMatches: ['/dashboard/email-activity', '/dashboard/calendar-activity'] }),
      tab('Contacts', '/dashboard/network/contacts', { menuKeys: ['contacts'] }),
      tab('Events to attend', '/dashboard/network/events'),
      tab('References', '/dashboard/references', { menuKeys: ['references'], alsoMatches: ['/dashboard/work-samples'] }),
      tab('Community', '/dashboard/community', { menuKeys: ['community'], alsoMatches: ['/dashboard/circle'] }),
      tab('Inbox', '/dashboard/messages', { menuKeys: ['inbox'] }),
      tab('My supporters', '/dashboard/supporters'),
      tab('My groups', '/dashboard/groups', { menuKeys: ['universities'], alsoMatches: ['/dashboard/universities', '/dashboard/past-jobs'] }),
      tab('Coaching', '/dashboard/my-coaching', { paid: 'coaching', alsoMatches: ['/dashboard/book-session', '/dashboard/coach', '/dashboard/coaching-match', '/dashboard/coaching-form', '/dashboard/coach-dossier'] }),
      tab('Recruiters', '/dashboard/recruiter-requests', { menuKeys: ['recruiter'], paid: 'recruiters', alsoMatches: [PREMIUM_HREF] }),
      tab('What recruiters see', '/dashboard/recruiter-report'),
    ],
    groups: [
      { label: 'This week', hrefs: ['/dashboard/network'] },
      { label: 'Contacts and events', hrefs: ['/dashboard/network/contacts', '/dashboard/network/events'] },
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
      tab('Learn new skills', '/dashboard/learning', { menuKeys: ['learning', 'growSkills'] }),
      tab('Videos and webinars', '/dashboard/webinars', { menuKeys: ['webinars'] }),
      tab('Know yourself', '/dashboard/skills-assessments', { menuKeys: ['assessments'], alsoMatches: ['/dashboard/skills-assessment', '/dashboard/retake-assessment'] }),
      tab('Career story', '/dashboard/my-career'),
      tab('Other roles you could do', '/dashboard/pivot-paths', { alsoMatches: ['/dashboard/pivot'] }),
      tab('Funding you qualify for', '/dashboard/funding'),
      tab('Your other paths', '/dashboard/other-paths'),
      tab('Buy a business', '/dashboard/buy-a-business'),
      tab('Courses your company covers', '/dashboard/company-courses', { employedOnly: true }),
    ],
    groups: [
      { label: 'Learn new skills', hrefs: ['/dashboard/learning', '/dashboard/webinars', '/dashboard/company-courses'] },
      { label: 'Know yourself', hrefs: ['/dashboard/skills-assessments'] },
      { label: 'Your path', hrefs: ['/dashboard/my-career', '/dashboard/pivot-paths'] },
      { label: 'Funding you qualify for', hrefs: ['/dashboard/funding'] },
      { label: 'Your other paths', hrefs: ['/dashboard/other-paths', '/dashboard/buy-a-business'] },
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
      tab('Profile', '/dashboard/profile', { alsoMatches: ['/dashboard/resume', '/dashboard/linkedin', '/dashboard/portfolio'] }),
      tab('Privacy', '/dashboard/privacy'),
      tab('Documents', '/dashboard/documents'),
      tab('Money help', '/dashboard/money-help'),
      tab('Membership', '/dashboard/membership'),
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
    tabs: [tab('Talk to someone', '/dashboard/support'), tab('A hard situation at work', '/dashboard/work-help', { employedOnly: true }), tab('Scam watch', '/dashboard/scam-watch'), tab('Questions and feedback', '/dashboard/help')],
    groups: [
      { label: 'Talk to someone', hrefs: ['/dashboard/support'] },
      { label: 'A hard situation at work', hrefs: ['/dashboard/work-help'] },
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
