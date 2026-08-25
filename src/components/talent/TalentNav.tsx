'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useFormStatus } from 'react-dom'
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
    { href: '/talent/team', label: 'Team' },
    { href: '/talent/settings', label: 'Settings' },
  ]
}

function NavContent({
  pathname,
  links,
  onNavigate,
}: {
  pathname: string
  links: NavLink[]
  onNavigate?: () => void
}) {
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <nav className="flex h-full flex-col gap-2 overflow-y-auto px-4 py-6">
      <div className="space-y-0.5">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              link.primary
                ? 'bg-success text-white hover:bg-success/90'
                : isActive(link.href)
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
            )}
          >
            <span>{link.label}</span>
            {link.badge && (
              <span className="rounded-full bg-orange/80 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                {link.badge}
              </span>
            )}
          </Link>
        ))}
      </div>
      <form action={signOut} className="mt-auto px-2">
        <SignOutButton />
      </form>
    </nav>
  )
}

export function TalentNav({ messagesUnreadCount = 0 }: { messagesUnreadCount?: number }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const links = buildLinks(messagesUnreadCount)
  const current = links.find((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))

  return (
    <>
      <PartnerTopBar surface="employer">
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

      <aside className="fixed inset-y-0 top-14 left-0 z-30 hidden w-64 bg-navy lg:block">
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-accent-employer" />
        <NavContent pathname={pathname} links={links} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-navy shadow-xl">
            <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-accent-employer" />
            <NavContent pathname={pathname} links={links} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
