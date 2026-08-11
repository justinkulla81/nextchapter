'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useFormStatus } from 'react-dom'
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
  title: string | null // null = ungrouped top items
  links: NavLink[]
}

function buildSections(
  portfolioAssetCount: number,
  supportNetworkUnreadCount: number,
  messagesUnreadCount: number,
  newBackchannelCount: number
): NavSection[] {
  return [
    {
      title: null,
      links: [{ href: '/dashboard', label: 'Success Dashboard' }],
    },
    {
      title: 'Personalize',
      links: [
        { href: '/dashboard/profile', label: 'My Profile' },
        { href: '/dashboard/search-strategy', label: 'My Search Strategy' },
        { href: '/dashboard/skills-assessments', label: 'Skills & Behavioral Assessments' },
        { href: '/dashboard/marketing-plan', label: 'My Marketing Plan' },
      ],
    },
    {
      title: 'Connecting',
      links: [
        {
          href: '/dashboard/network',
          label: 'Network with Contacts',
          // A real "you know someone at a company you applied to" count
          // takes priority over the generic High Priority label — it's a
          // more specific, more actionable reason to visit right now.
          badge: newBackchannelCount > 0 ? String(newBackchannelCount) : 'Priority',
        },
        { href: '/dashboard/references', label: 'My References', badge: 'Priority' },
        {
          href: '/dashboard/community',
          label: 'NextChapter Community',
          badge:
            supportNetworkUnreadCount + messagesUnreadCount > 0
              ? String(supportNetworkUnreadCount + messagesUnreadCount)
              : undefined,
        },
        { href: '/coaching', label: 'Executive Coach', badge: 'Premium' },
        {
          href: '/dashboard/privacy',
          label: 'Executive Recruiter',
          badge: 'Coming Soon',
          muted: true,
          disabled: true,
        },
      ],
    },
    {
      title: 'Learning & Working',
      links: [
        { href: '/dashboard/learning', label: 'Learn New Skills', badge: 'Priority' },
        { href: '/dashboard/interim-work', label: 'Find Interim Work', badge: 'Priority' },
        { href: '/dashboard/find-my-job', label: 'Find a Full-time Job', badge: 'Priority' },
        { href: '/dashboard/got-hired', label: 'Got An Offer 🎉' },
      ],
    },
    {
      title: 'Data',
      links: [
        { href: '/dashboard/network/contacts', label: 'My Contacts' },
        {
          href: '/dashboard/portfolio',
          label: 'My Portfolio',
          badge: portfolioAssetCount > 0 ? String(portfolioAssetCount) : undefined,
        },
        { href: '/dashboard/stats', label: 'My Stats & Reports' },
        { href: '/dashboard/privacy', label: 'Privacy Settings' },
      ],
    },
    {
      title: 'Misc',
      links: [
        { href: '/dashboard/benefits', label: 'Benefits & Financial Bridge' },
        { href: "/dashboard/support", label: "I'm Struggling" },
        { href: '/faq', label: 'FAQ' },
      ],
    },
  ]
}

function NavContent({
  pathname,
  onNavigate,
  portfolioAssetCount,
  supportNetworkUnreadCount,
  messagesUnreadCount,
  newBackchannelCount,
  collapsedSections,
  onToggleSection,
}: {
  pathname: string
  onNavigate?: () => void
  portfolioAssetCount: number
  supportNetworkUnreadCount: number
  messagesUnreadCount: number
  newBackchannelCount: number
  collapsedSections: Set<string>
  onToggleSection: (title: string) => void
}) {
  const isActive = (href: string) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href))
  const sections = buildSections(portfolioAssetCount, supportNetworkUnreadCount, messagesUnreadCount, newBackchannelCount)

  return (
    <nav className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-6">
      <Logo className="px-2 text-xl text-white" />
      {sections.map((section, i) => {
        const collapsed = !!section.title && collapsedSections.has(section.title)
        return (
        <div key={section.title ?? `top-${i}`} className="space-y-px">
          {section.title && (
            <button
              type="button"
              onClick={() => onToggleSection(section.title!)}
              aria-expanded={!collapsed}
              className="flex w-full items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold tracking-widest text-orange/60 uppercase hover:text-orange/80"
            >
              {section.title}
              <svg
                viewBox="0 0 24 24"
                className={cn('size-3.5 shrink-0 text-orange transition-transform', collapsed && '-rotate-90')}
                fill="none"
                stroke="currentColor"
                strokeWidth={3.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}
          {!collapsed && section.links.map((link) => {
            const badgeEl = link.badge && (
              <span
                className={cn(
                  'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap tracking-wide uppercase',
                  link.muted ? 'bg-white/10 text-white/50' : 'bg-orange/20 text-orange'
                )}
              >
                {link.badge}
              </span>
            )

            if (link.disabled) {
              return (
                <div
                  key={`${section.title ?? 'top'}-${link.href}`}
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center justify-between gap-2 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap text-white/40"
                >
                  <span>{link.label}</span>
                  {badgeEl}
                </div>
              )
            }

            return (
              <Link
                key={`${section.title ?? 'top'}-${link.href}`}
                href={link.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors',
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
      <div className="mt-auto px-2">
        <form action={signOut}>
          <SignOutButton />
        </form>
      </div>
    </nav>
  )
}

export function DashboardNav({
  portfolioAssetCount = 0,
  supportNetworkUnreadCount = 0,
  messagesUnreadCount = 0,
  newBackchannelCount = 0,
}: {
  portfolioAssetCount?: number
  supportNetworkUnreadCount?: number
  messagesUnreadCount?: number
  newBackchannelCount?: number
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // Data and Misc start collapsed, everything else expanded — same literal
  // default on server and first client render to avoid a hydration
  // mismatch; a saved per-user state (if any) loads a frame later and
  // overrides this.
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['Data', 'Misc']))

  useEffect(() => {
    const saved = localStorage.getItem('nc-nav-collapsed-sections')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setCollapsedSections(new Set(JSON.parse(saved)))
  }, [])

  function toggleSection(title: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      localStorage.setItem('nc-nav-collapsed-sections', JSON.stringify([...next]))
      return next
    })
  }

  const sections = buildSections(portfolioAssetCount, supportNetworkUnreadCount, messagesUnreadCount, newBackchannelCount)
  const current = sections
    .flatMap((s) => s.links)
    .filter((link) => (link.href === '/dashboard' ? pathname === link.href : pathname.startsWith(link.href)))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return (
    <>
      {/* Desktop: persistent sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 bg-navy lg:block">
        <NavContent
          pathname={pathname}
          portfolioAssetCount={portfolioAssetCount}
          supportNetworkUnreadCount={supportNetworkUnreadCount}
          messagesUnreadCount={messagesUnreadCount}
          newBackchannelCount={newBackchannelCount}
          collapsedSections={collapsedSections}
          onToggleSection={toggleSection}
        />
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
            {current?.label ?? 'Menu'}
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 bg-navy shadow-xl">
            <NavContent
              pathname={pathname}
              onNavigate={() => setOpen(false)}
              portfolioAssetCount={portfolioAssetCount}
              supportNetworkUnreadCount={supportNetworkUnreadCount}
              messagesUnreadCount={messagesUnreadCount}
              newBackchannelCount={newBackchannelCount}
              collapsedSections={collapsedSections}
              onToggleSection={toggleSection}
            />
          </div>
        </div>
      )}
    </>
  )
}
