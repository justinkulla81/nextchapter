'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'
import { signOut } from '@/app/dashboard/actions'
import { PartnerTopBar } from '@/components/partners/PartnerTopBar'

function SignOutButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'text-sm font-medium text-white/50 transition-colors hover:text-white',
        pending && 'cursor-progress'
      )}
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}

interface NavLink {
  href: string
  label: string
  badge?: string
  /** 'alert' (default, orange) means this needs action — a queue, a review.
   * 'count' (gray) is a plain size — a directory, a bin — never a call to
   * do something. Mixing the two into one orange style would make every
   * list in the nav look like it's waiting on you. */
  badgeTone?: 'alert' | 'count'
  muted?: boolean
  disabled?: boolean
}

interface NavSection {
  title: string
  links: NavLink[]
  /** Renders the header as a toggle. Only the Administrator area uses this —
   * it has ~70 links, so everything but the section you're in stays folded. */
  collapsible?: boolean
  /** Open on first load even when it doesn't hold the current page. */
  defaultOpen?: boolean
}

/**
 * The admin is three separate tools that happen to share a login.
 *
 * Administrator runs the product; Ecosystem is the relationship system;
 * Vision is the product-management system. Showing all three at once produced
 * a sidebar of ~60 links where the thing you wanted was never where you
 * looked, so only the current area's sections render and the switcher moves
 * between them.
 */
export type AdminArea = 'administrator' | 'ecosystem' | 'vision'

export const AREAS: { key: AdminArea; label: string; href: string; hint: string }[] = [
  { key: 'administrator', label: 'Web Admin', href: '/support/admin', hint: 'Running the product' },
  { key: 'ecosystem', label: 'CRM', href: '/support/admin/crm/home', hint: 'People and organizations' },
  { key: 'vision', label: 'Operations', href: '/support/admin/vision', hint: 'What we build and why' },
]

/** Which area a path belongs to. Order matters: the specific prefixes first. */
export function areaForPath(pathname: string): AdminArea {
  if (pathname.startsWith('/support/admin/crm')) return 'ecosystem'
  if (pathname.startsWith('/support/admin/vision')) return 'vision'
  return 'administrator'
}

function ecosystemSections(badges: Record<string, number>): NavSection[] {
  const badgeFor = (key: string) => (badges[key] > 0 ? String(badges[key]) : undefined)
  // Same undefined-at-zero rule as badgeFor, so an empty bin shows no pill
  // rather than a gray "0".
  const countFor = (key: string) => (badges[key] > 0 ? String(badges[key]) : undefined)

  // Grouped by the job you came to do, not by when each page was built.
  // Anything with an orange badge (waiting on you) sits in "To do"; email has
  // one home so "where do I send from" has one answer.
  return [
    {
      title: 'Overview',
      links: [{ href: '/support/admin/crm/home', label: 'Home' }],
    },
    {
      title: 'To do',
      collapsible: true,
      defaultOpen: true,
      links: [
        // "Org queue"/"People queue" — same idea (what's overdue right now:
        // a broken promise, a missed next step), split by whether the
        // opportunity's overdue item belongs to a company or to a person.
        { href: '/support/admin/crm/queue', label: 'Org follow-ups', badge: badgeFor('crmQueue') },
        { href: '/support/admin/crm/queue/people', label: 'People follow-ups', badge: badgeFor('crmPeopleQueue') },
        { href: '/support/admin/crm/contact-messages', label: 'Contact messages', badge: badgeFor('contactUnhandled') },
        { href: '/support/admin/crm/needs-completion', label: 'Review List', badge: badgeFor('needsCompletion') },
        { href: '/support/admin/crm/needs-review', label: 'Activity to review', badge: badgeFor('activityReview') },
        { href: '/support/admin/crm/company-links', label: 'Company links' },
        { href: '/support/admin/crm/rap-sheets', label: 'Prep for tomorrow' },
      ],
    },
    {
      title: 'Pipeline',
      collapsible: true,
      links: [
        { href: '/support/admin/crm/leads', label: 'All leads' },
        { href: '/support/admin/crm/pipelines', label: 'Pipelines' },
        { href: '/support/admin/crm/dates', label: 'Upcoming dates' },
      ],
    },
    {
      title: 'Records',
      collapsible: true,
      links: [
        { href: '/support/admin/crm', label: 'People', badge: countFor('peopleTotal'), badgeTone: 'count' },
        { href: '/support/admin/crm/organizations', label: 'Organizations', badge: countFor('orgsTotal'), badgeTone: 'count' },
        { href: '/support/admin/crm/research', label: 'Research' },
        { href: '/support/admin/crm/removed', label: 'Removed', badge: countFor('removedTotal'), badgeTone: 'count' },
      ],
    },
    {
      title: 'Email',
      collapsible: true,
      links: [
        // The bulk-send surface. Each list has a cadence; due sends are
        // drafted for you and wait here for approval.
        { href: '/support/admin/crm/mailing', label: 'Mailing lists', badge: badgeFor('mailingAttention') },
        { href: '/support/admin/crm/mailing/lists', label: 'Lists and sender settings' },
        { href: '/support/admin/crm/mailing/unsubscribes', label: 'Unsubscribes' },
        { href: '/support/admin/crm/segments', label: 'One-off segment emails' },
      ],
    },
    {
      title: 'Lead sources',
      collapsible: true,
      links: [
        // Pending == not yet promoted to a lead or dismissed — the one
        // state on this page that is actually waiting on you.
        { href: '/support/admin/crm/warn', label: 'Layoff notices', badge: badgeFor('warnPending') },
        { href: '/support/admin/crm/workforce-boards', label: 'Workforce boards' },
        { href: '/support/admin/crm/colleges', label: 'Colleges' },
        { href: '/support/admin/network-leads', label: 'Candidate-surfaced leads' },
      ],
    },
    {
      title: 'Import and sync',
      collapsible: true,
      links: [
        { href: '/support/admin/crm/import', label: 'Upload CSV' },
        { href: '/support/admin/crm/sync', label: 'Activity sync' },
        { href: '/support/admin/crm/capture-tokens', label: 'Capture tokens' },
      ],
    },
  ]
}

function visionSections(): NavSection[] {
  // The URL stays /vision (bookmarks, links in emails); the area is labelled
  // Operations. Only Product has pages today — the rest are placeholders so
  // the shape is visible while they get built.
  const soon = (key: string): NavLink => ({ href: `#${key}-soon`, label: 'Coming soon', disabled: true })
  return [
    {
      title: 'Product',
      collapsible: true,
      defaultOpen: true,
      links: [
        { href: '/support/admin/vision', label: 'Overview' },
        { href: '/support/admin/vision/doc', label: 'Master vision' },
        { href: '/support/admin/vision/items', label: 'Roadmap' },
        { href: '/support/admin/vision/brainstorm', label: 'Brainstorm' },
        { href: '/support/admin/vision/feedback', label: 'Feedback' },
        { href: '/support/admin/vision/competitors', label: 'Competitors' },
      ],
    },
    { title: 'Marketing', collapsible: true, links: [soon('marketing')] },
    { title: 'Operations', collapsible: true, links: [soon('operations')] },
    { title: 'Revenue', collapsible: true, links: [soon('revenue')] },
    { title: 'Customer service', collapsible: true, links: [soon('customer-service')] },
    // Eventually fed by webhooks from the accounting system.
    { title: 'Financials', collapsible: true, links: [soon('financials')] },
  ]
}

export function buildSectionsForArea(area: AdminArea, badges: Record<string, number>): NavSection[] {
  if (area === 'ecosystem') return ecosystemSections(badges)
  if (area === 'vision') return visionSections()
  return buildSections(badges)
}

function buildSections(badges: Record<string, number>): NavSection[] {
  const badgeFor = (key: string) => (badges[key] > 0 ? String(badges[key]) : undefined)
  const A = '/support/admin'

  // Grouped by the job you're doing, not by which table the page reads.
  // "Review queues" is every page where an orange badge means something is
  // waiting on you, so the first thing in the menu answers "what needs me?".
  return [
    {
      title: 'Overview',
      links: [{ href: A, label: 'Home' }],
    },
    {
      title: 'Review queues',
      collapsible: true,
      defaultOpen: true,
      links: [
        { href: `${A}/help`, label: 'Help inbox', badge: badgeFor('helpNeedsReply') },
        { href: `${A}/requests`, label: 'Requests', badge: badgeFor('requests') },
        { href: `${A}/identity-matches`, label: 'Identity Matches', badge: badgeFor('identityMatches') },
        { href: `${A}/bounty-claims`, label: 'Offer Bonus Claims', badge: badgeFor('bountyClaims') },
        { href: `${A}/scholarship-applications`, label: 'Scholarship Applications', badge: badgeFor('scholarshipApplications') },
        { href: `${A}/eqoveriq-applications`, label: 'EQoverIQ Applications', badge: badgeFor('eqoveriqApplications') },
        { href: `${A}/reference-disputes`, label: 'Reference Disputes', badge: badgeFor('referenceDisputes') },
        { href: `${A}/reported-messages`, label: 'Reported Conversations', badge: badgeFor('reportedMessages') },
        { href: `${A}/community-moderation`, label: 'Community Moderation', badge: badgeFor('communityModeration') },
      ],
    },
    {
      title: 'Candidates',
      collapsible: true,
      links: [
        { href: `${A}/candidates`, label: 'All candidates' },
        { href: `${A}/candidates/declined-commitment`, label: 'Declined Commitment' },
        { href: `${A}/layoff-cohorts`, label: 'Layoff Cohorts' },
        { href: `${A}/performance`, label: 'Performance' },
        { href: `${A}/pacing`, label: 'Pacing' },
        { href: `${A}/platform-engagement`, label: 'Work & Learning' },
        { href: `${A}/search-checkins`, label: 'Search Check-ins' },
        { href: `${A}/weekly-recognition`, label: 'Weekly Recognition Archive' },
      ],
    },
    {
      title: 'Coaching',
      collapsible: true,
      links: [
        { href: `${A}/coaches`, label: 'Coaches' },
        { href: `${A}/coach-matches`, label: 'Coach Matches' },
        { href: `${A}/coaching-reassignments`, label: 'Reassignments & Surge' },
        { href: `${A}/coaching-rates`, label: 'Rate Card' },
        { href: `${A}/coaching-settings`, label: 'Settings' },
      ],
    },
    {
      title: 'Employers & jobs',
      collapsible: true,
      links: [
        { href: `${A}/employers`, label: 'Employers' },
        { href: `${A}/companies`, label: 'Companies' },
        { href: `${A}/exclusive-jobs`, label: 'Job Board', badge: badgeFor('jobBoard') },
        { href: `${A}/jobs`, label: 'Jobs' },
        { href: `${A}/interim-listings`, label: 'Interim Work Listings' },
      ],
    },
    {
      title: 'Recruiters',
      collapsible: true,
      links: [
        { href: `${A}/recruiters`, label: 'Recruiters' },
        { href: `${A}/recruiter-database`, label: 'Database' },
        { href: `${A}/recruiter-settings`, label: 'Settings' },
      ],
    },
    {
      title: 'Trust & community',
      collapsible: true,
      links: [
        { href: `${A}/references`, label: 'References' },
        { href: `${A}/employer-references`, label: 'Employer References' },
        { href: `${A}/community-stories`, label: 'Community Stories' },
        { href: `${A}/classification-feedback`, label: 'Detection Feedback' },
        { href: `${A}/bias-detection`, label: 'Bias Detection' },
      ],
    },
    {
      title: 'Programs & content',
      collapsible: true,
      links: [
        { href: `${A}/courses`, label: 'Courses' },
        { href: `${A}/webinars`, label: 'Videos and Webinars' },
        { href: `${A}/nen-sessions`, label: 'NEN Sessions' },
        { href: `${A}/nen-employers`, label: 'NEN Employers' },
        { href: `${A}/nen-contests`, label: 'NEN Contests' },
        { href: `${A}/eqoveriq-contributors`, label: 'EQoverIQ Contributors' },
        { href: `${A}/alumni-groups`, label: 'Alumni & Employer Networks' },
        { href: `${A}/benefits-network`, label: 'Alumni Benefits Network' },
      ],
    },
    {
      title: 'Money',
      collapsible: true,
      links: [
        { href: `${A}/plan-catalog`, label: 'Plan Catalog' },
        { href: `${A}/margin-dashboard`, label: 'Margin Dashboard' },
        { href: `${A}/outplacement-contracts`, label: 'Employer Contracts' },
      ],
    },
    {
      title: 'Reports',
      collapsible: true,
      links: [
        { href: `${A}/metrics`, label: 'Site Metrics' },
        { href: `${A}/visitors`, label: 'Visitors' },
        { href: `${A}/action-counts`, label: 'Action Counts' },
        { href: `${A}/population`, label: 'Population Report' },
        { href: `${A}/issues`, label: 'Resume Issue Analytics' },
        { href: `${A}/pedigree-signals`, label: 'Pedigree Signals' },
      ],
    },
    {
      title: 'Site & email',
      collapsible: true,
      links: [
        { href: `${A}/page-content`, label: 'Page Content' },
        { href: `${A}/email-cadence`, label: 'Email Cadence' },
        // Weekly Market Digest (queue + send history) lives at the bottom of
        // this same page — see Market Pulse's own page.tsx comment.
        { href: `${A}/digest`, label: 'Market Pulse' },
        { href: `${A}/tracking-testers`, label: 'Gmail/Calendar Testers' },
      ],
    },
  ]
}

function NavContent({
  pathname,
  onNavigate,
  badges,
}: {
  pathname: string
  onNavigate?: () => void
  badges: Record<string, number>
}) {
  // Exact-match roots that also have a nested nav link of their own
  // (declined-commitment lives under /candidates) — without this, visiting the
  // child route highlights both entries at once. /crm and /vision are here for
  // the same reason: both have many children.
  const EXACT_MATCH_ROOTS = new Set([
    '/support/admin', '/support/admin/candidates', '/support/admin/crm', '/support/admin/vision',
  ])
  const matches = (href: string) =>
    EXACT_MATCH_ROOTS.has(href) ? pathname === href : pathname === href || pathname.startsWith(href + '/')
  const area = areaForPath(pathname)
  const sections = buildSectionsForArea(area, badges)
  // Only the most specific match lights up, so /crm/mailing/lists highlights
  // "Lists and sender settings" alone, not "Mailing lists" too.
  const activeHref = sections
    .flatMap((s) => s.links.map((l) => l.href))
    .filter(matches)
    .sort((a, b) => b.length - a.length)[0]
  const isActive = (href: string) => href === activeHref
  // Per-section overrides of the default (open if it holds the current page).
  const [toggled, setToggled] = useState<Record<string, boolean>>({})

  return (
    <nav className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-6">
      {/*
        Three discrete areas -> adjacent buttons rather than a dropdown, per
        design-principles.md. Each one lands on the page you actually want to
        start from, not a shell: the Ecosystem opens on its home page, which
        links into the queues.
      */}
      <div className="mb-1" role="group" aria-label="Admin area">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-white/5 p-1">
          {AREAS.map((a) => (
            <Link
              key={a.key}
              href={a.href}
              onClick={onNavigate}
              aria-current={area === a.key ? 'page' : undefined}
              title={a.hint}
              className={cn(
                'rounded-md px-1.5 py-1.5 text-center text-[11px] font-semibold transition-colors',
                area === a.key ? 'bg-white text-navy shadow-sm' : 'text-white/60 hover:bg-white/10 hover:text-white'
              )}
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>
      {sections.map((section) => {
        const hasActive = section.links.some((l) => isActive(l.href))
        const isOpen = !section.collapsible || (toggled[section.title] ?? (hasActive || !!section.defaultOpen))
        // A folded section still has to say when something inside needs you.
        const alertCount = section.links.reduce(
          (n, l) => n + (l.badge && l.badgeTone !== 'count' ? Number(l.badge) || 0 : 0),
          0
        )
        return (
        <div key={section.title} className="space-y-px">
          {section.collapsible ? (
            <button
              type="button"
              onClick={() => setToggled((t) => ({ ...t, [section.title]: !isOpen }))}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-2 rounded-md bg-black/25 px-2 py-1.5 text-left text-[11px] font-semibold tracking-widest text-white/80 uppercase transition-colors hover:bg-black/40 hover:text-white"
            >
              <span className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className={cn('size-3 transition-transform', isOpen && 'rotate-90')} fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                </svg>
                {section.title}
              </span>
              {!isOpen && alertCount > 0 && (
                <span className="rounded-full bg-orange/20 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-orange">
                  {alertCount}
                </span>
              )}
            </button>
          ) : (
            <p className="px-2 pb-1 text-[11px] font-semibold tracking-widest text-white/50 uppercase">
              {section.title}
            </p>
          )}
          {isOpen && section.links.map((link) => {
            const badgeEl = link.badge && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase',
                  link.badgeTone === 'count' ? 'bg-white/10 text-white/60' : 'bg-orange/20 text-orange'
                )}
              >
                {link.badge}
              </span>
            )

            if (link.disabled) {
              return (
                <div
                  key={link.href}
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center justify-between gap-2 rounded-md px-2 py-1 text-xs font-medium text-white/40"
                >
                  <span>{link.label}</span>
                  {badgeEl}
                </div>
              )
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  isActive(link.href)
                    ? 'bg-white/15 text-white'
                    : link.muted
                      ? 'text-white/40 hover:bg-white/10 hover:text-white/60'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                <span>{link.label}</span>
                {badgeEl}
              </Link>
            )
          })}
        </div>
        )
      })}
      <form action={signOut} className="mt-auto px-2">
        <SignOutButton />
      </form>
    </nav>
  )
}

const COLLAPSED_KEY = 'admin-nav-collapsed'
const COLLAPSED_EVENT = 'admin-nav-collapsed-change'
function subscribeCollapsed(cb: () => void) {
  window.addEventListener(COLLAPSED_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => { window.removeEventListener(COLLAPSED_EVENT, cb); window.removeEventListener('storage', cb) }
}
function readCollapsed() {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false }
}

export function AdminNav({ badges = {} }: { badges?: Record<string, number> }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const sections = buildSectionsForArea(areaForPath(pathname), badges)
  // Remembered per browser. Read through useSyncExternalStore so the server
  // render (always expanded) and the first client render agree, then it flips.
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false)
  // The layout offsets its content by --admin-nav-w and caps it at
  // --admin-max-w (both fall back to the expanded values), so hiding the menu
  // hands the whole width to the page instead of just moving the gutter.
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--admin-nav-w', collapsed ? '0rem' : '16rem')
    root.setProperty('--admin-max-w', collapsed ? '100%' : '80rem')
  }, [collapsed])
  function toggleCollapsed() {
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '0' : '1') } catch { /* not persisted */ }
    window.dispatchEvent(new Event(COLLAPSED_EVENT))
  }
  const current = sections
    .flatMap((s) => s.links)
    .filter((link) => pathname.startsWith(link.href))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return (
    <>
      <PartnerTopBar surface="admin">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-pressed={collapsed}
          aria-label={collapsed ? 'Show navigation menu' : 'Hide navigation menu'}
          className="hidden items-center gap-2 rounded-md border border-white/30 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10 lg:flex"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {collapsed ? 'Show menu' : 'Hide menu'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-label="Open navigation menu"
          className="flex items-center gap-2 rounded-md border border-white/30 px-3 py-1.5 text-sm font-medium text-white lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {current?.label ?? 'Admin'}
        </button>
      </PartnerTopBar>

      {/* Desktop: persistent sidebar */}
      <aside className={`fixed inset-y-0 top-14 left-0 z-30 hidden w-64 bg-navy ${collapsed ? '' : 'lg:block'}`}>
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-accent-admin" />
        <NavContent pathname={pathname} badges={badges} />
      </aside>

      {/* Mobile: slide-out drawer, triggered from the top bar above */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-navy shadow-xl">
            <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-accent-admin" />
            <NavContent pathname={pathname} onNavigate={() => setOpen(false)} badges={badges} />
          </div>
        </div>
      )}
    </>
  )
}
