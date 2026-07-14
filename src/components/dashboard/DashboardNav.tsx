'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/Logo'
import { signOut } from '@/app/dashboard/actions'

interface NavLink {
  href: string
  label: string
}

interface NavSection {
  title: string | null // null = ungrouped top items
  links: NavLink[]
}

const SECTIONS: NavSection[] = [
  {
    title: null,
    links: [
      { href: '/dashboard', label: 'Overview' },
      { href: '/dashboard/hireability-report', label: 'My Report' },
      { href: '/dashboard/weekly-report', label: 'Weekly Report' },
    ],
  },
  {
    title: 'Plan',
    links: [
      { href: '/dashboard/sprint', label: 'Success Sprint' },
      { href: '/dashboard/network', label: 'My Network' },
      { href: '/dashboard/interview', label: 'Interview Prep' },
    ],
  },
  {
    title: 'Build',
    links: [
      { href: '/dashboard/resume', label: 'Resume' },
      { href: '/dashboard/linkedin', label: 'LinkedIn' },
      { href: '/dashboard/profile', label: 'Profile' },
      { href: '/dashboard/retake-assessment', label: 'Retake Assessment' },
      { href: '/dashboard/privacy', label: 'Privacy' },
      { href: '/dashboard/work-samples', label: 'Proof Assets' },
      { href: '/dashboard/thought-leadership', label: 'Thought Leadership' },
      { href: '/dashboard/references', label: 'References' },
    ],
  },
  {
    title: 'Discover',
    links: [
      { href: '/dashboard/job-fit', label: 'Job Fit' },
      { href: '/dashboard/gig-directory', label: 'Interim Jobs' },
      { href: '/dashboard/community', label: 'Community' },
      { href: '/dashboard/circle', label: 'The Circle' },
      { href: '/dashboard/learning', label: 'Learning' },
      { href: '/dashboard/benefits', label: 'Benefits' },
    ],
  },
]

function NavContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const isActive = (href: string) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href))

  return (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-6">
      <Logo className="px-2 text-xl text-white" />
      {SECTIONS.map((section, i) => (
        <div key={section.title ?? `top-${i}`} className="space-y-0.5">
          {section.title && (
            <p className="px-2 pb-1 text-xs font-semibold tracking-widest text-white/50 uppercase">
              {section.title}
            </p>
          )}
          {section.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={cn(
                'block rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                isActive(link.href)
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      ))}
      <form action={signOut} className="mt-auto px-2">
        <button
          type="submit"
          className="text-sm font-medium text-white/50 transition-colors hover:text-white"
        >
          Sign out
        </button>
      </form>
    </nav>
  )
}

export function DashboardNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const current = SECTIONS.flatMap((s) => s.links).find((link) =>
    link.href === '/dashboard' ? pathname === link.href : pathname.startsWith(link.href)
  )

  return (
    <>
      {/* Desktop: persistent sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-navy lg:block">
        <NavContent pathname={pathname} />
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
          <div className="fixed inset-y-0 left-0 w-64 bg-navy shadow-xl">
            <NavContent pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
