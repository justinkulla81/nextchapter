// The dashboard's six places. Every dashboard route belongs to exactly one,
// and each place shows the same small tab row on all of its pages, so the
// menu is six items instead of thirty. Routes are unchanged: a tab is a link
// to an existing page, so nothing moves and old links keep working.

import { itemVisibility, statusUnlock, type MenuItemKey, type MenuMode } from '@/lib/journey/menu'

export type PlaceKey = 'home' | 'jobs' | 'network' | 'learn' | 'personalize' | 'help'

export interface PlaceTab {
  label: string
  href: string
  // Extra path prefixes that should light this tab up (sub-pages).
  alsoMatches?: string[]
  // Only shown when the member is in one of the employed journeys.
  employedOnly?: boolean
  // The menu rules (src/lib/journey/menu.ts) that decide this tab by the member's
  // situation: hidden when every one is hidden for it, muted with a way to update
  // their status when the rest are locked. A tab with none always shows.
  menuKeys?: MenuItemKey[]
  // Only shown to students, new grads and people up to 5 years in
  // (src/lib/early-career/audience.ts).
  earlyCareerOnly?: boolean
  // Needs coaching or the recruiter network (membership, or a grant such as an
  // outplacement seat or coach code). Without it the tab leads to the Premium
  // page and is marked Premium.
  paid?: PaidKey
}

export type PaidKey = 'coaching' | 'recruiters'
export type PaidAccess = Record<PaidKey, boolean>
export const PREMIUM_HREF = '/dashboard/premium'

// Where a tab goes for this member: the real page when they have access, the
// Premium page when they don't.
export function resolveTabHref(tab: PlaceTab, access: PaidAccess): string {
  return tab.paid && !access[tab.paid] ? PREMIUM_HREF : tab.href
}

// What the menu shows. Related tabs are grouped into one entry, so a place lists at
// most six things. A group with several tabs shows them as small switches at the top
// of its pages. Every tab belongs to exactly one group.
export interface PlaceGroup {
  label: string
  /** The `href` of each tab in the group, first one is where the entry opens. */
  hrefs: string[]
}

export interface Place {
  key: PlaceKey
  label: string
  // Where the place's nav item goes.
  href: string
  tabs: PlaceTab[]
  // The menu entries for this place. Absent: one entry per tab.
  groups?: PlaceGroup[]
  // Route prefixes with no tab of their own that still belong here.
  alsoPrefixes?: string[]
}

/** What the menu helpers need of a place, so the redesigned set (redesign-places.ts) shares them. */
export type PlaceShape = Pick<Place, 'tabs' | 'groups'>

export const PLACES: Place[] = [
  {
    key: 'home',
    label: 'Home',
    href: '/dashboard',
    tabs: [
      { label: 'Today', href: '/dashboard' },
      { label: 'Progress', href: '/dashboard/stats', alsoMatches: ['/dashboard/sprint', '/dashboard/plans'] },
    ],
    groups: [
      { label: 'Today', hrefs: ['/dashboard'] },
      { label: 'Progress', hrefs: ['/dashboard/stats'] },
    ],
    alsoPrefixes: ['/dashboard/checkin', '/dashboard/complete-profile'],
  },
  {
    key: 'jobs',
    label: 'Jobs',
    href: '/dashboard/find-my-job',
    tabs: [
      { menuKeys: ['jobs'], label: 'Find a job', href: '/dashboard/find-my-job', alsoMatches: ['/dashboard/job-board', '/dashboard/job-discovery', '/dashboard/job-fit', '/dashboard/interim-work'] },
      { label: 'Early career plan', href: '/dashboard/early-career', earlyCareerOnly: true },
      { menuKeys: ['companies'], label: 'Companies', href: '/dashboard/companies', alsoMatches: ['/dashboard/company-tracker'] },
      { label: 'Market', href: '/dashboard/market', alsoMatches: ['/dashboard/market-reality', '/dashboard/market-intelligence'] },
      { label: 'Know your worth', href: '/dashboard/pay' },
      { menuKeys: ['local'], label: 'Local market', href: '/dashboard/local-market' },
      { menuKeys: ['growCase'], label: 'Build your case', href: '/dashboard/review-prep' },
      { label: 'Pivot paths', href: '/dashboard/pivot-paths', alsoMatches: ['/dashboard/pivot'] },
      { label: 'From my groups', href: '/dashboard/alumni-jobs' },
      { menuKeys: ['interviewPrep', 'growConversation'], label: 'Interview prep', href: '/dashboard/interview-prep' },
      { label: 'Reviews and raises', href: '/dashboard/in-work', employedOnly: true },
      { menuKeys: ['offer', 'careerFirst90'], label: 'Got an offer', href: '/dashboard/got-hired' },
    ],
    groups: [
      { label: 'Find a job', hrefs: ['/dashboard/find-my-job', '/dashboard/alumni-jobs'] },
      { label: 'Early career plan', hrefs: ['/dashboard/early-career'] },
      { label: 'Companies', hrefs: ['/dashboard/companies'] },
      { label: 'Market and pay', hrefs: ['/dashboard/market', '/dashboard/pay', '/dashboard/local-market', '/dashboard/pivot-paths'] },
      { label: 'Interviews and reviews', hrefs: ['/dashboard/interview-prep', '/dashboard/review-prep'] },
      { label: 'Offers and raises', hrefs: ['/dashboard/got-hired', '/dashboard/in-work'] },
    ],
  },
  {
    key: 'network',
    label: 'Network',
    href: '/dashboard/network',
    tabs: [
      { menuKeys: ['network', 'careerNetwork'], label: 'This week', href: '/dashboard/network', alsoMatches: ['/dashboard/email-activity', '/dashboard/calendar-activity'] },
      { menuKeys: ['contacts'], label: 'Contacts', href: '/dashboard/network/contacts' },
      { menuKeys: ['references'], label: 'References', href: '/dashboard/references', alsoMatches: ['/dashboard/work-samples'] },
      { menuKeys: ['community'], label: 'Community', href: '/dashboard/community', alsoMatches: ['/dashboard/circle'] },
      { menuKeys: ['inbox'], label: 'Inbox', href: '/dashboard/messages' },
      { label: 'My supporters', href: '/dashboard/supporters' },
      { menuKeys: ['universities'], label: 'My groups', href: '/dashboard/groups', alsoMatches: ['/dashboard/universities', '/dashboard/past-jobs'] },
      { label: 'Coaching', href: '/dashboard/my-coaching', paid: 'coaching', alsoMatches: ['/dashboard/book-session', '/dashboard/coach', '/dashboard/coaching-match', '/dashboard/coaching-form', '/dashboard/coach-dossier'] },
      { menuKeys: ['recruiter'], label: 'Recruiters', href: '/dashboard/recruiter-requests', paid: 'recruiters', alsoMatches: [PREMIUM_HREF] },
    ],
    groups: [
      { label: 'This week', hrefs: ['/dashboard/network'] },
      { label: 'Contacts', hrefs: ['/dashboard/network/contacts'] },
      { label: 'Community', hrefs: ['/dashboard/community', '/dashboard/messages', '/dashboard/groups'] },
      { label: 'References and supporters', hrefs: ['/dashboard/references', '/dashboard/supporters'] },
      { label: 'Coaching', hrefs: ['/dashboard/my-coaching'] },
      { label: 'Recruiters', hrefs: ['/dashboard/recruiter-requests'] },
    ],
  },
  {
    key: 'learn',
    label: 'Learn',
    href: '/dashboard/learning',
    tabs: [
      { menuKeys: ['learning', 'growSkills'], label: 'Learn new skills', href: '/dashboard/learning' },
      { menuKeys: ['webinars'], label: 'Videos and webinars', href: '/dashboard/webinars' },
    ],
    groups: [
      { label: 'Learn new skills', hrefs: ['/dashboard/learning'] },
      { label: 'Videos and webinars', hrefs: ['/dashboard/webinars'] },
    ],
  },
  {
    key: 'personalize',
    label: 'Personalize',
    href: '/dashboard/strengths',
    tabs: [
      { label: 'My story', href: '/dashboard/strengths', alsoMatches: ['/dashboard/track-record', '/dashboard/how-i-perform'] },
      { label: 'My profile', href: '/dashboard/profile', alsoMatches: ['/dashboard/resume', '/dashboard/linkedin', '/dashboard/portfolio'] },
      { menuKeys: ['assessments'], label: 'My work profile', href: '/dashboard/skills-assessments', alsoMatches: ['/dashboard/work-profile', '/dashboard/skills-assessment', '/dashboard/retake-assessment'] },
      { label: 'Career timeline', href: '/dashboard/my-career' },
      { menuKeys: ['strategy'], label: 'My search', href: '/dashboard/search-strategy', alsoMatches: ['/dashboard/what-i-need', '/dashboard/marketing-plan', '/dashboard/platforms'] },
      { label: 'For recruiters', href: '/dashboard/recruiter-report', alsoMatches: ['/dashboard/privacy'] },
      { label: 'Documents', href: '/dashboard/documents' },
      { label: 'Membership', href: '/dashboard/membership' },
    ],
    groups: [
      { label: 'My profile', hrefs: ['/dashboard/profile', '/dashboard/strengths', '/dashboard/skills-assessments'] },
      { label: 'My search', hrefs: ['/dashboard/search-strategy'] },
      { label: 'For recruiters', hrefs: ['/dashboard/recruiter-report'] },
      { label: 'Documents', hrefs: ['/dashboard/documents'] },
      { label: 'Membership', hrefs: ['/dashboard/membership'] },
    ],
  },
  {
    key: 'help',
    label: 'Help',
    href: '/dashboard/support',
    tabs: [
      { label: 'Talk to someone', href: '/dashboard/support' },
      { menuKeys: ['benefits'], label: 'Money and benefits', href: '/dashboard/benefits', alsoMatches: ['/dashboard/benefits-network'] },
      { label: 'Scam watch', href: '/dashboard/scam-watch' },
      { label: 'Questions and feedback', href: '/dashboard/help' },
    ],
    groups: [
      { label: 'Talk to someone', hrefs: ['/dashboard/support'] },
      { label: 'Money and benefits', hrefs: ['/dashboard/benefits'] },
      { label: 'Scam watch', hrefs: ['/dashboard/scam-watch'] },
      { label: 'Questions and feedback', hrefs: ['/dashboard/help'] },
    ],
  },
]

export function matches(pathname: string, href: string): boolean {
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

export function activeTab(place: PlaceShape, pathname: string): PlaceTab | null {
  let best: { tab: PlaceTab; len: number } | null = null
  for (const tab of place.tabs) {
    for (const h of [tab.href, ...(tab.alsoMatches ?? [])]) {
      if (matches(pathname, h) && (!best || h.length > best.len)) best = { tab, len: h.length }
    }
  }
  return best?.tab ?? null
}

// A tab by the member's situation: shown, locked until their status changes, or
// hidden. A tab several menu rules decide is hidden only when all hide it, and
// locked only when none shows it.
export function tabSituation(tab: PlaceTab, mode: MenuMode | null | undefined): 'show' | 'locked' | 'hide' {
  if (!mode || !tab.menuKeys?.length) return 'show'
  const states = tab.menuKeys.map((k) => itemVisibility(k, mode))
  if (states.includes('show')) return 'show'
  return states.includes('locked') ? 'locked' : 'hide'
}

export function visibleTabs(place: PlaceShape, opts: { employed: boolean; earlyCareer?: boolean; mode?: MenuMode | null }): PlaceTab[] {
  return place.tabs.filter((t) => (!t.employedOnly || opts.employed) && (!t.earlyCareerOnly || !!opts.earlyCareer) && tabSituation(t, opts.mode) !== 'hide')
}

// Tabs the member's situation turns off for now, to name in the "Turn on more tools" box.
export function statusLockedTabs(place: PlaceShape, opts: { employed: boolean; earlyCareer?: boolean; mode?: MenuMode | null }): string[] {
  return visibleTabs(place, opts).filter((t) => tabSituation(t, opts.mode) === 'locked').map((t) => t.label)
}

export { tabMatches }

export interface NavLocks {
  hasEmailConnection: boolean
  skillsAssessmentCompleted: boolean
  // The member's situation (src/lib/journey/menu.ts); unset shows everything.
  mode?: MenuMode | null
}

export const GMAIL_LOCK_REASON =
  'Unlocks once you connect Gmail — we can then track your outreach and application cadence automatically. Connect on your Profile page.'

const GMAIL_LOCKED = ['/dashboard/find-my-job', '/dashboard/network', '/dashboard/network/contacts']
// Learn is deliberately not locked on the Skills Assessment: the page opens so
// members can see what they're missing, and the personalized sections show a
// locked preview with a prompt to take the assessment (see LockedPreview).

// Same gates the old sidebar applied, now per tab: a locked tab explains
// itself and never blocks the rest of its place.
export function lockReasonFor(href: string, locks: NavLocks, tab?: PlaceTab): string | null {
  if (tab && tabSituation(tab, locks.mode) === 'locked') {
    const unlock = locks.mode ? statusUnlock(locks.mode) : null
    return unlock ? `${unlock.why} Use "Turn on more tools" to update your status.` : 'Turns on when your situation changes.'
  }
  if (!locks.hasEmailConnection && GMAIL_LOCKED.includes(href)) return GMAIL_LOCK_REASON
  return null
}

// The first tab a member can actually open, so a place is never a dead end.
export function entryHref(place: PlaceShape, locks: NavLocks, employed: boolean): string | null {
  const tab = visibleTabs(place, { employed, mode: locks.mode }).find((t) => !lockReasonFor(t.href, locks, t))
  return tab?.href ?? null
}

// ── Menu entries ────────────────────────────────────────────────────────────

export interface MenuEntry {
  label: string
  /** Where it opens: the first of its tabs the member can use. Null when every tab is locked. */
  href: string | null
  /** The tabs that show now, in order. More than one means small switches on the page. */
  tabs: PlaceTab[]
  /** Why it is locked, when it is. */
  lockReason: string | null
  active: boolean
  /** The tab the member is on, inside this entry. */
  activeTab: PlaceTab | null
}

export function groupsOf(place: PlaceShape): PlaceGroup[] {
  return place.groups ?? place.tabs.map((t) => ({ label: t.label, hrefs: [t.href] }))
}

/** The place's menu entries for this member and page: hidden tabs dropped, locks explained. */
export function menuEntries(
  place: PlaceShape,
  pathname: string,
  opts: { employed: boolean; earlyCareer?: boolean; locks: NavLocks; paidAccess: PaidAccess },
): MenuEntry[] {
  const shown = new Set(visibleTabs(place, { employed: opts.employed, earlyCareer: opts.earlyCareer, mode: opts.locks.mode }).map((t) => t.href))
  const current = activeTab(place, pathname)
  const entries: MenuEntry[] = []
  for (const g of groupsOf(place)) {
    const tabs = g.hrefs.map((h) => place.tabs.find((t) => t.href === h)).filter((t): t is PlaceTab => !!t && shown.has(t.href))
    if (tabs.length === 0) continue
    const open = tabs.find((t) => !lockReasonFor(t.href, opts.locks, t))
    entries.push({
      label: g.label,
      href: open ? resolveTabHref(open, opts.paidAccess) : null,
      tabs,
      lockReason: open ? null : lockReasonFor(tabs[0].href, opts.locks, tabs[0]),
      active: !!current && tabs.some((t) => t.href === current.href),
      activeTab: tabs.find((t) => t.href === current?.href) ?? null,
    })
  }
  return entries
}
