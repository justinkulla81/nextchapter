'use client'

import { useState } from 'react'
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
  muted?: boolean
  disabled?: boolean
}

interface NavSection {
  title: string
  links: NavLink[]
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
  { key: 'administrator', label: 'Administrator', href: '/support/admin', hint: 'Running the product' },
  { key: 'ecosystem', label: 'Ecosystem', href: '/support/admin/crm/queue', hint: 'People and organizations' },
  { key: 'vision', label: 'Vision', href: '/support/admin/vision', hint: 'What we build and why' },
]

/** Which area a path belongs to. Order matters: the specific prefixes first. */
export function areaForPath(pathname: string): AdminArea {
  if (pathname.startsWith('/support/admin/crm')) return 'ecosystem'
  if (pathname.startsWith('/support/admin/vision')) return 'vision'
  return 'administrator'
}

function ecosystemSections(): NavSection[] {
  return [
    {
      title: 'Work the list',
      links: [
        { href: '/support/admin/crm/queue', label: 'Queue' },
        { href: '/support/admin/crm/leads', label: 'All leads' },
        { href: '/support/admin/crm/pipelines', label: 'Pipelines' },
        { href: '/support/admin/crm/dates', label: 'Upcoming dates' },
      ],
    },
    {
      title: 'Records',
      links: [
        { href: '/support/admin/crm', label: 'People' },
        { href: '/support/admin/crm/organizations', label: 'Organizations' },
        { href: '/support/admin/crm/research', label: 'Research' },
        { href: '/support/admin/crm/needs-completion', label: 'Needs completion' },
      ],
    },
    {
      title: 'Data in and out',
      links: [
        { href: '/support/admin/crm/import', label: 'Upload CSV' },
        { href: '/support/admin/crm/sync', label: 'Activity sync' },
        { href: '/support/admin/crm/segments', label: 'Segments and updates' },
        { href: '/support/admin/crm/capture-tokens', label: 'Capture tokens' },
        { href: '/support/admin/network-leads', label: 'Candidate-surfaced leads' },
      ],
    },
  ]
}

function visionSections(): NavSection[] {
  return [
    {
      title: 'Direction',
      links: [
        { href: '/support/admin/vision', label: 'Overview' },
        { href: '/support/admin/vision/doc', label: 'Master vision' },
      ],
    },
    {
      title: 'Work',
      links: [
        { href: '/support/admin/vision/items', label: 'Roadmap' },
        { href: '/support/admin/vision/brainstorm', label: 'Brainstorm' },
        { href: '/support/admin/vision/feedback', label: 'Feedback' },
      ],
    },
    {
      title: 'Market',
      links: [{ href: '/support/admin/vision/competitors', label: 'Competitors' }],
    },
  ]
}

export function buildSectionsForArea(area: AdminArea, badges: Record<string, number>): NavSection[] {
  if (area === 'ecosystem') return ecosystemSections()
  if (area === 'vision') return visionSections()
  return buildSections(badges)
}

function buildSections(badges: Record<string, number>): NavSection[] {
  const badgeFor = (key: string) => (badges[key] > 0 ? String(badges[key]) : undefined)

  return [
    {
      title: 'Candidates',
      links: [
        { href: '/support/admin/candidates', label: 'Candidates' },
        { href: '/support/admin/candidates/declined-commitment', label: 'Declined Commitment' },
        { href: '/support/admin/performance', label: 'Performance' },
        { href: '/support/admin/pacing', label: 'Pacing' },
        { href: '/support/admin/layoff-cohorts', label: 'Layoff Cohorts' },
        { href: '/support/admin/weekly-recognition', label: 'Weekly Recognition Archive' },
        { href: '/support/admin/bounty-claims', label: 'Offer Bonus Claims', badge: badgeFor('bountyClaims') },
        { href: '/support/admin/scholarship-applications', label: 'Scholarship Applications', badge: badgeFor('scholarshipApplications') },
        { href: '/support/admin/identity-matches', label: 'Identity Matches', badge: badgeFor('identityMatches') },
        { href: '/support/admin/references', label: 'References' },
        { href: '/support/admin/reference-disputes', label: 'Reference Disputes', badge: badgeFor('referenceDisputes') },
        { href: '/support/admin/employer-references', label: 'Employer References' },
        { href: '/support/admin/reported-messages', label: 'Reported Conversations', badge: badgeFor('reportedMessages') },
        { href: '/support/admin/community-moderation', label: 'Community Moderation', badge: badgeFor('communityModeration') },
        { href: '/support/admin/community-stories', label: 'Community Stories' },
      ],
    },
    {
      title: 'Coaches',
      links: [
        { href: '/support/admin/coaches', label: 'Coaches' },
        { href: '/support/admin/coach-matches', label: 'Coach Matches' },
        { href: '/support/admin/coaching-reassignments', label: 'Reassignments & Surge' },
        { href: '/support/admin/coaching-rates', label: 'Coaching Rate Card' },
        { href: '/support/admin/coaching-settings', label: 'Coaching Settings' },
      ],
    },
    {
      title: 'Employers',
      links: [
        { href: '/support/admin/employers', label: 'Employers' },
        { href: '/support/admin/exclusive-jobs', label: 'Job Board', badge: badgeFor('jobBoard') },
      ],
    },
    {
      title: 'Recruiters',
      links: [
        { href: '/support/admin/recruiters', label: 'Recruiters' },
        { href: '/support/admin/recruiter-database', label: 'Recruiter Database' },
        { href: '/support/admin/recruiter-settings', label: 'Recruiter Settings' },
      ],
    },
    {
      title: 'NEN',
      links: [
        { href: '/support/admin/nen-sessions', label: 'Sessions' },
        { href: '/support/admin/nen-employers', label: 'Employers' },
        { href: '/support/admin/nen-contests', label: 'Contests' },
      ],
    },
    {
      title: 'EQoverIQ',
      links: [
        { href: '/support/admin/eqoveriq-applications', label: 'Applications', badge: badgeFor('eqoveriqApplications') },
        { href: '/support/admin/eqoveriq-contributors', label: 'Contributors' },
      ],
    },
    {
      title: 'Companies',
      links: [{ href: '/support/admin/companies', label: 'Companies' }],
    },
    {
      title: 'Commercial',
      links: [
        { href: '/support/admin/plan-catalog', label: 'Plan Catalog' },
        { href: '/support/admin/margin-dashboard', label: 'Margin Dashboard' },
        { href: '/support/admin/outplacement-contracts', label: 'Employer Contracts' },
      ],
    },
    {
      title: 'Admin',
      links: [
        { href: '/support/admin/requests', label: 'Requests', badge: badgeFor('requests') },
        { href: '/support/admin/issues', label: 'Resume Issue Analytics' },
        { href: '/support/admin/jobs', label: 'Jobs' },
        { href: '/support/admin/action-counts', label: 'Action Counts' },
        { href: '/support/admin/metrics', label: 'Site Metrics' },
        { href: '/support/admin/population', label: 'Population Report' },
        { href: '/support/admin/page-content', label: 'Page Content' },
        { href: '/support/admin/email-cadence', label: 'Email Cadence' },
        { href: '/support/admin/search-checkins', label: 'Search Check-ins' },
        { href: '/support/admin/courses', label: 'Courses' },
        { href: '/support/admin/alumni-groups', label: 'Alumni & Employer Networks' },
        { href: '/support/admin/webinars', label: 'Videos and Webinars' },
        { href: '/support/admin/pedigree-signals', label: 'Pedigree Signals' },
        { href: '/support/admin/interim-listings', label: 'Interim Work Listings' },
        { href: '/support/admin/benefits-network', label: 'Alumni Benefits Network' },
        { href: '/support/admin/bias-detection', label: 'Bias Detection' },
        // Weekly Market Digest (queue + send history) lives at the bottom of
        // this same page now — see Market Pulse's own page.tsx comment. It
        // was never actually "Coming soon" (that nav label was stale); the
        // three per-audience sends are real, live weekly crons.
        { href: '/support/admin/digest', label: 'Market Pulse' },
        { href: '/support/admin/tracking-testers', label: 'Gmail/Calendar Testers' },
        { href: '/support/admin/visitors', label: 'Visitors' },
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
  const isActive = (href: string) => (EXACT_MATCH_ROOTS.has(href) ? pathname === href : pathname.startsWith(href))
  const area = areaForPath(pathname)
  const sections = buildSectionsForArea(area, badges)

  return (
    <nav className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-6">
      {/*
        Three discrete areas -> adjacent buttons rather than a dropdown, per
        design-principles.md. Each one lands on the page you actually want to
        start from, not a shell: the Ecosystem opens on its queue.
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
        <p className="mt-1.5 px-2 text-[10px] text-white/40">
          {AREAS.find((a) => a.key === area)?.hint}
        </p>
      </div>
      {sections.map((section) => (
        <div key={section.title} className="space-y-px">
          <p className="px-2 pb-1 text-[11px] font-semibold tracking-widest text-white/50 uppercase">
            {section.title}
          </p>
          {section.links.map((link) => {
            const badgeEl = link.badge && (
              <span className="rounded-full bg-orange/20 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-orange uppercase">
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
      ))}
      <form action={signOut} className="mt-auto px-2">
        <SignOutButton />
      </form>
    </nav>
  )
}

export function AdminNav({ badges = {} }: { badges?: Record<string, number> }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const sections = buildSections(badges)
  const current = sections.flatMap((s) => s.links).find((link) => pathname.startsWith(link.href))

  return (
    <>
      <PartnerTopBar surface="admin">
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
      <aside className="fixed inset-y-0 top-14 left-0 z-30 hidden w-64 bg-navy lg:block">
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
