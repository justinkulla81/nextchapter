'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useFormStatus } from 'react-dom'
import { signOutHiring as signOut } from '@/app/auth/portal-sign-out'
import { PartnerTopBar } from '@/components/partners/PartnerTopBar'
import type { PartnerBrand } from '@/lib/partners/brand'
import { SignOutForm } from '@/components/auth/SignOutForm'
import { SectionSwitcher, type SwitcherLinkItem } from '@/components/employer/SectionSwitcher'

function SignOutButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'text-sm font-medium text-muted-foreground transition-colors hover:text-ink',
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
  primary?: boolean
  badge?: string
}

function buildLinks(messagesUnreadCount: number): NavLink[] {
  return [
    // Now that /talent (bare) is a public marketing page and the real home
    // moved to /talent/dashboard, nothing else in this list points back to
    // it — without an explicit link, there was no way back to the overview
    // (candidate matches, active role count) once you navigated away.
    { href: '/talent/dashboard', label: 'Dashboard' },
    { href: '/talent/roles/new', label: 'Post a Role', primary: true },
    { href: '/talent/roles', label: 'My Roles' },
    { href: '/talent/candidates', label: 'Candidate Inbox' },
    { href: '/talent/saved', label: 'Saved Candidates' },
    {
      href: '/talent/messages',
      label: 'Messages',
      badge: messagesUnreadCount > 0 ? String(messagesUnreadCount) : undefined,
    },
    { href: '/talent/analytics', label: 'Hiring Analytics' },
    { href: '/talent/job-board/submissions', label: 'Job Board' },
    { href: '/talent/network', label: 'Your network' },
    { href: '/talent/team', label: 'Team' },
    { href: '/talent/activity', label: 'Downloads and activity' },
    { href: '/talent/settings', label: 'Settings' },
  ]
}

function NavContent({
  pathname,
  links,
  onNavigate,
  sections = [],
}: {
  pathname: string
  links: NavLink[]
  onNavigate?: () => void
  sections?: SwitcherLinkItem[]
}) {
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <nav className="flex h-full flex-col gap-2 overflow-y-auto px-4 py-6">
      {/* The top bar carries the switcher from md up; the drawer carries it below that. */}
      <SectionSwitcher items={sections} onDark={false} className="flex-wrap px-2 pb-3 md:hidden" />
      <div className="space-y-0.5">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            aria-current={isActive(link.href) ? 'page' : undefined}
            className={cn('nc-portal-link', link.primary && 'nc-portal-link-primary')}
          >
            <span>{link.label}</span>
            {link.badge && (
              <span className="rounded-full bg-orange px-1.5 py-0.5 text-[11px] font-semibold text-navy">
                {link.badge}
              </span>
            )}
          </Link>
        ))}
      </div>
      <SignOutForm action={signOut} className="mt-auto px-2">
        <SignOutButton />
      </SignOutForm>
    </nav>
  )
}

export function TalentNav({ messagesUnreadCount = 0, brand, sections = [] }: { messagesUnreadCount?: number; brand?: PartnerBrand; sections?: SwitcherLinkItem[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const links = buildLinks(messagesUnreadCount)
  const current = links.find((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))

  return (
    <>
      <PartnerTopBar surface="employer" use="Hiring" brand={brand} switcher={<SectionSwitcher items={sections} />}>
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
          {current?.label ?? 'Menu'}
        </button>
      </PartnerTopBar>

      <aside className="nc-portal-rail fixed inset-y-0 top-14 left-0 z-30 hidden w-64 lg:block">
        <NavContent pathname={pathname} links={links} sections={sections} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="nc-portal-rail fixed inset-y-0 left-0 w-64 shadow-xl">
            <NavContent pathname={pathname} links={links} sections={sections} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
