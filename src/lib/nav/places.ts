// The dashboard's six places. Every dashboard route belongs to exactly one,
// and each place shows the same small tab row on all of its pages, so the
// menu is six items instead of thirty. Routes are unchanged: a tab is a link
// to an existing page, so nothing moves and old links keep working.

export type PlaceKey = 'home' | 'jobs' | 'network' | 'learn' | 'personalize' | 'help'

export interface PlaceTab {
  label: string
  href: string
  // Extra path prefixes that should light this tab up (sub-pages).
  alsoMatches?: string[]
  // Only shown when the member is in one of the employed journeys.
  employedOnly?: boolean
}

export interface Place {
  key: PlaceKey
  label: string
  // Where the place's nav item goes.
  href: string
  tabs: PlaceTab[]
  // Route prefixes with no tab of their own that still belong here.
  alsoPrefixes?: string[]
}

export const PLACES: Place[] = [
  {
    key: 'home',
    label: 'Home',
    href: '/dashboard',
    tabs: [
      { label: 'Today', href: '/dashboard' },
      { label: 'Progress', href: '/dashboard/stats', alsoMatches: ['/dashboard/sprint', '/dashboard/plans'] },
    ],
    alsoPrefixes: ['/dashboard/checkin', '/dashboard/complete-profile'],
  },
  {
    key: 'jobs',
    label: 'Jobs',
    href: '/dashboard/find-my-job',
    tabs: [
      { label: 'Find a job', href: '/dashboard/find-my-job', alsoMatches: ['/dashboard/job-board', '/dashboard/job-discovery', '/dashboard/job-fit', '/dashboard/interim-work'] },
      { label: 'Companies', href: '/dashboard/companies', alsoMatches: ['/dashboard/company-tracker'] },
      { label: 'Market', href: '/dashboard/market', alsoMatches: ['/dashboard/market-reality', '/dashboard/market-intelligence'] },
      { label: 'Pivot paths', href: '/dashboard/pivot-paths' },
      { label: 'From my groups', href: '/dashboard/alumni-jobs' },
      { label: 'Interview prep', href: '/dashboard/interview-prep' },
      { label: 'Reviews and raises', href: '/dashboard/in-work', employedOnly: true },
      { label: 'Got an offer', href: '/dashboard/got-hired' },
    ],
  },
  {
    key: 'network',
    label: 'Network',
    href: '/dashboard/network',
    tabs: [
      { label: 'This week', href: '/dashboard/network', alsoMatches: ['/dashboard/email-activity', '/dashboard/calendar-activity'] },
      { label: 'Contacts', href: '/dashboard/network/contacts' },
      { label: 'References', href: '/dashboard/references', alsoMatches: ['/dashboard/work-samples'] },
      { label: 'Community', href: '/dashboard/community', alsoMatches: ['/dashboard/circle'] },
      { label: 'Inbox', href: '/dashboard/messages' },
      { label: 'My groups', href: '/dashboard/universities' },
      { label: 'Recruiters and coaches', href: '/dashboard/recruiter-requests', alsoMatches: ['/dashboard/coach', '/dashboard/coaching-match', '/dashboard/coaching-form', '/dashboard/coach-dossier', '/dashboard/premium'] },
    ],
  },
  {
    key: 'learn',
    label: 'Learn',
    href: '/dashboard/learning',
    tabs: [
      { label: 'Learn new skills', href: '/dashboard/learning' },
      { label: 'Videos and webinars', href: '/dashboard/webinars' },
    ],
  },
  {
    key: 'personalize',
    label: 'Personalize',
    href: '/dashboard/strengths',
    tabs: [
      { label: 'My story', href: '/dashboard/strengths', alsoMatches: ['/dashboard/track-record', '/dashboard/how-i-perform'] },
      { label: 'My profile', href: '/dashboard/profile', alsoMatches: ['/dashboard/resume', '/dashboard/linkedin', '/dashboard/portfolio'] },
      { label: 'My work profile', href: '/dashboard/skills-assessments', alsoMatches: ['/dashboard/work-profile', '/dashboard/skills-assessment', '/dashboard/retake-assessment'] },
      { label: 'My search', href: '/dashboard/search-strategy', alsoMatches: ['/dashboard/what-i-need', '/dashboard/marketing-plan', '/dashboard/platforms'] },
      { label: 'For recruiters', href: '/dashboard/recruiter-report', alsoMatches: ['/dashboard/privacy'] },
      { label: 'Membership', href: '/dashboard/membership' },
    ],
  },
  {
    key: 'help',
    label: 'Help',
    href: '/dashboard/support',
    tabs: [
      { label: 'Talk to someone', href: '/dashboard/support' },
      { label: 'Money and benefits', href: '/dashboard/benefits', alsoMatches: ['/dashboard/benefits-network'] },
      { label: 'Questions and feedback', href: '/dashboard/help' },
    ],
  },
]

function matches(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function tabMatches(pathname: string, tab: PlaceTab): boolean {
  return matches(pathname, tab.href) || (tab.alsoMatches ?? []).some((p) => matches(pathname, p))
}

// The place a pathname belongs to, or null for pages outside the six places.
// Longest matching href wins so /dashboard/network/contacts is a Network
// page, not a Home page.
export function placeForPath(pathname: string): Place | null {
  let best: { place: Place; len: number } | null = null
  for (const place of PLACES) {
    const hrefs = [...place.tabs.flatMap((t) => [t.href, ...(t.alsoMatches ?? [])]), ...(place.alsoPrefixes ?? [])]
    for (const h of hrefs) {
      if (matches(pathname, h) && (!best || h.length > best.len)) best = { place, len: h.length }
    }
  }
  return best?.place ?? null
}

export function activeTab(place: Place, pathname: string): PlaceTab | null {
  let best: { tab: PlaceTab; len: number } | null = null
  for (const tab of place.tabs) {
    for (const h of [tab.href, ...(tab.alsoMatches ?? [])]) {
      if (matches(pathname, h) && (!best || h.length > best.len)) best = { tab, len: h.length }
    }
  }
  return best?.tab ?? null
}

export function visibleTabs(place: Place, opts: { employed: boolean }): PlaceTab[] {
  return place.tabs.filter((t) => !t.employedOnly || opts.employed)
}

export { tabMatches }

export interface NavLocks {
  hasEmailConnection: boolean
  skillsAssessmentCompleted: boolean
}

export const GMAIL_LOCK_REASON =
  'Unlocks once you connect Gmail — we can then track your outreach and application cadence automatically. Connect on your Profile page.'
export const SKILLS_LOCK_REASON = 'Unlocks once you complete the Skills Assessment'

const GMAIL_LOCKED = ['/dashboard/find-my-job', '/dashboard/network', '/dashboard/network/contacts']
const SKILLS_LOCKED = ['/dashboard/learning', '/dashboard/webinars']

// Same gates the old sidebar applied, now per tab: a locked tab explains
// itself and never blocks the rest of its place.
export function lockReasonFor(href: string, locks: NavLocks): string | null {
  if (!locks.hasEmailConnection && GMAIL_LOCKED.includes(href)) return GMAIL_LOCK_REASON
  if (!locks.skillsAssessmentCompleted && SKILLS_LOCKED.includes(href)) return SKILLS_LOCK_REASON
  return null
}

// The first tab a member can actually open, so a place is never a dead end.
export function entryHref(place: Place, locks: NavLocks, employed: boolean): string | null {
  const tab = visibleTabs(place, { employed }).find((t) => !lockReasonFor(t.href, locks))
  return tab?.href ?? null
}
