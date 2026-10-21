// What the candidate menu is made of (the places themselves are in redesign-places.ts): tabs, the
// menu rules that show, lock or hide them by the member's situation, paid access, and menu entries.

import { itemVisibility, statusUnlock, type MenuItemKey, type MenuMode } from '@/lib/journey/menu'

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
  label: string
  // Where the place's nav item goes.
  href: string
  tabs: PlaceTab[]
  // The menu entries for this place. Absent: one entry per tab.
  groups?: PlaceGroup[]
  // Route prefixes with no tab of their own that still belong here.
  alsoPrefixes?: string[]
}

/** What the menu helpers need of a place. */
export type PlaceShape = Pick<Place, 'tabs' | 'groups'>

export function matches(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
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
