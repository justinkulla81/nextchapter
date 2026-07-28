'use client'

import { useState } from 'react'
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
}

// A few destinations are accessToken-gated URLs rather than plain paths
// (this portal predates Supabase-session auth and never migrated those
// routes off it) — accessToken is threaded in just to build these three
// hrefs, nothing else.
function buildLinks(accessToken: string, messagesUnreadCount: number, actionCount: number): NavLink[] {
  return [
    { href: '/support/coach', label: 'Home' },
    {
      href: `/support/coach/clients/${accessToken}`,
      label: 'Your Clients',
      badge: actionCount > 0 ? String(actionCount) : undefined,
    },
    { href: `/support/coach/caseload/${accessToken}`, label: 'Caseload' },
    {
      href: '/support/coach/messages',
      label: 'Messages',
      badge: messagesUnreadCount > 0 ? String(messagesUnreadCount) : undefined,
    },
    { href: '/support/coach/invite-client', label: 'Invite a Client' },
    { href: `/support/coach/invite/${accessToken}`, label: 'Share Invite Link' },
    { href: '/support/coach/settings', label: 'Settings' },
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
  const isActive = (href: string) =>
    href === '/support/coach' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <nav className="flex h-full flex-col gap-2 overflow-y-auto px-4 py-6">
      <Logo className="px-2 text-xl text-white" />
      <div className="mt-4 space-y-0.5">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              isActive(link.href) ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
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

export function CoachNav({
  accessToken,
  messagesUnreadCount = 0,
  actionCount = 0,
}: {
  accessToken: string
  messagesUnreadCount?: number
  actionCount?: number
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const links = buildLinks(accessToken, messagesUnreadCount, actionCount)
  const current = links.find((link) =>
    link.href === '/support/coach' ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`)
  )

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-navy lg:block">
        <NavContent pathname={pathname} links={links} />
      </aside>

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
          <div className="fixed inset-y-0 left-0 w-64 bg-navy shadow-xl">
            <NavContent pathname={pathname} links={links} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
