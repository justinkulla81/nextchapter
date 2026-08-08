'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/Logo'
import { signOut } from '@/app/dashboard/actions'

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

function buildSections(badges: Record<string, number>): NavSection[] {
  const badgeFor = (key: string) => (badges[key] > 0 ? String(badges[key]) : undefined)

  return [
    {
      title: 'Candidates',
      links: [
        { href: '/support/admin/candidates', label: 'Candidates' },
        { href: '/support/admin/candidates/declined-commitment', label: 'Declined Commitment' },
        { href: '/support/admin/sentiment', label: 'Sentiment' },
        { href: '/support/admin/pacing', label: 'Pacing' },
        { href: '/support/admin/layoff-cohorts', label: 'Layoff Cohorts (Coming soon)', muted: true, disabled: true },
        { href: '/support/admin/weekly-recognition', label: 'Weekly Recognition Archive' },
        { href: '/support/admin/bounty-claims', label: 'Offer Bonus Claims', badge: badgeFor('bountyClaims') },
        { href: '/support/admin/reference-disputes', label: 'Reference Disputes', badge: badgeFor('referenceDisputes') },
        { href: '/support/admin/employer-references', label: 'Employer References' },
      ],
    },
    {
      title: 'Coaches',
      links: [
        { href: '/support/admin/coaches', label: 'Coaches' },
        { href: '/support/admin/coach-matches', label: 'Coach Matches' },
      ],
    },
    {
      title: 'Hiring Managers',
      links: [
        { href: '/support/admin/employers', label: 'Hiring Managers' },
        { href: '/support/admin/exclusive-jobs', label: 'Job Board', badge: badgeFor('jobBoard') },
      ],
    },
    {
      title: 'Recruiters',
      links: [
        { href: '/support/admin/recruiters', label: 'Recruiters' },
        { href: '/support/admin/recruiter-database', label: 'Recruiter Database' },
      ],
    },
    {
      title: 'Admin',
      links: [
        { href: '/support/admin/requests', label: 'Requests', badge: badgeFor('requests') },
        { href: '/support/admin/jobs', label: 'Jobs' },
        { href: '/support/admin/action-counts', label: 'Action Counts' },
        { href: '/support/admin/metrics', label: 'Site Metrics' },
        { href: '/support/admin/page-content', label: 'Page Content' },
        { href: '/support/admin/pedigree-signals', label: 'Pedigree Signals' },
        { href: '/support/admin/interim-listings', label: 'Interim Work Listings' },
        { href: '/support/admin/bias-detection', label: 'Bias Detection' },
        { href: '/support/admin/research', label: 'Research Library' },
        { href: '/support/admin/tracking-testers', label: 'Gmail/Calendar Testers' },
        { href: '/support/admin/network-leads', label: 'Network Leads' },
        { href: '/support/admin/digest', label: 'Weekly Market Digest (Coming soon)', muted: true, disabled: true },
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
  // (declined-commitment lives under /candidates) — without this, visiting
  // the child route highlights both entries at once.
  const EXACT_MATCH_ROOTS = new Set(['/support/admin', '/support/admin/candidates'])
  const isActive = (href: string) => (EXACT_MATCH_ROOTS.has(href) ? pathname === href : pathname.startsWith(href))
  const sections = buildSections(badges)

  return (
    <nav className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-6">
      <Link href="/support/admin" className="px-2">
        <Logo className="text-xl text-white" />
      </Link>
      <Link
        href="/support/admin"
        onClick={onNavigate}
        className={cn(
          'rounded-md px-2 py-1 text-xs font-medium transition-colors',
          pathname === '/support/admin' ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
        )}
      >
        Home
      </Link>
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
      {/* Desktop: persistent sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-navy lg:block">
        <NavContent pathname={pathname} badges={badges} />
      </aside>

      {/* Mobile: top bar with toggle + slide-out drawer */}
      <div className="border-b border-border bg-background lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo className="text-lg" />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-label="Open navigation menu"
            className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            {current?.label ?? 'Admin'}
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-navy shadow-xl">
            <NavContent pathname={pathname} onNavigate={() => setOpen(false)} badges={badges} />
          </div>
        </div>
      )}
    </>
  )
}
