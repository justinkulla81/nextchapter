'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/profile', label: 'Profile' },
  { href: '/dashboard/references', label: 'References' },
  { href: '/dashboard/work-samples', label: 'Work Samples' },
  { href: '/dashboard/resume', label: 'Resume' },
  { href: '/dashboard/linkedin', label: 'LinkedIn' },
  { href: '/dashboard/job-fit', label: 'Job Fit' },
  { href: '/dashboard/community', label: 'Community' },
  { href: '/dashboard/circle', label: 'The Circle' },
  { href: '/dashboard/network', label: 'My Network' },
  { href: '/dashboard/thought-leadership', label: 'Thought Leadership' },
  { href: '/dashboard/job-discovery', label: 'Job Discovery' },
  { href: '/dashboard/learning', label: 'Learning' },
  { href: '/dashboard/benefits', label: 'Benefits' },
  { href: '/dashboard/gig-directory', label: 'Fractional/Gig' },
  { href: '/dashboard/hireability-report', label: 'My Report' },
  { href: '/dashboard/weekly-report', label: 'Weekly Report' },
  { href: '/dashboard/interview', label: 'Interview' },
  { href: '/dashboard/privacy', label: 'Privacy' },
]

export function DashboardNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href))
  const current = LINKS.find((link) => isActive(link.href))

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Toggle navigation menu"
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
      >
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {current?.label ?? 'Menu'}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <nav className="absolute left-0 z-50 mt-1 flex max-h-[70vh] w-64 flex-col gap-0.5 overflow-y-auto rounded-md border border-border bg-background p-1.5 shadow-lg">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive(link.href)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </>
      )}
    </div>
  )
}
