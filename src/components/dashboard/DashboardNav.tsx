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

interface NavSection {
  title: string | null // null = ungrouped top items
  links: NavLink[]
}

const SECTIONS: NavSection[] = [
  {
    title: null,
    links: [
      { href: '/dashboard', label: 'Success Dashboard' },
      { href: '/dashboard/hireability-report', label: 'Hireability Report' },
      { href: '/dashboard/sprint', label: 'Success Sprint' },
      { href: '/dashboard/got-hired', label: 'Got Hired 🎉' },
    ],
  },
  {
    title: 'Build',
    links: [
      { href: '/dashboard/resume', label: 'Resume' },
      { href: '/dashboard/linkedin', label: 'LinkedIn' },
      { href: '/dashboard/job-fit', label: 'Job Fit' },
      { href: '/dashboard/retake-assessment', label: 'My Working Style' },
      { href: '/dashboard/work-samples', label: 'Proof Assets' },
      { href: '/dashboard/thought-leadership', label: 'Thought Leadership' },
      { href: '/dashboard/references', label: 'References' },
      { href: '/dashboard/interview-prep', label: 'Interview Prep' },
      { href: '/dashboard/interview', label: 'Interview Responses' },
    ],
  },
  {
    title: 'Discover',
    links: [
      { href: '/dashboard/network', label: 'My Network' },
      { href: '/dashboard/gig-directory', label: 'Interim Roles' },
      { href: '/dashboard/community', label: 'Community' },
      { href: '/dashboard/learning', label: 'Learning' },
      { href: '/dashboard/benefits', label: 'Benefits' },
      { href: '/coaching', label: 'Executive Coach', badge: 'Premium' },
    ],
  },
  {
    title: null,
    links: [
      { href: '/dashboard/profile', label: 'Profile' },
      { href: '/dashboard/privacy', label: 'Privacy' },
    ],
  },
]

function NavContent({
  pathname,
  onNavigate,
  hideWorkSamples,
}: {
  pathname: string
  onNavigate?: () => void
  hideWorkSamples?: boolean
}) {
  const isActive = (href: string) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href))
  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    links: section.links.filter((link) => !(hideWorkSamples && link.href === '/dashboard/work-samples')),
  }))

  return (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-6">
      <Logo className="px-2 text-xl text-white" />
      {visibleSections.map((section, i) => (
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
                'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                isActive(link.href)
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <span>{link.label}</span>
              {link.badge && (
                <span className="rounded-full bg-orange/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-orange uppercase">
                  {link.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      ))}
      <form action={signOut} className="mt-auto px-2">
        <SignOutButton />
      </form>
    </nav>
  )
}

export function DashboardNav({ hideWorkSamples }: { hideWorkSamples?: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const current = SECTIONS.flatMap((s) => s.links).find((link) =>
    link.href === '/dashboard' ? pathname === link.href : pathname.startsWith(link.href)
  )

  return (
    <>
      {/* Desktop: persistent sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-navy lg:block">
        <NavContent pathname={pathname} hideWorkSamples={hideWorkSamples} />
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
            <NavContent pathname={pathname} onNavigate={() => setOpen(false)} hideWorkSamples={hideWorkSamples} />
          </div>
        </div>
      )}
    </>
  )
}
