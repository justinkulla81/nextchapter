'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/references', label: 'References' },
  { href: '/dashboard/work-samples', label: 'Work Samples' },
  { href: '/dashboard/resume', label: 'Resume' },
  { href: '/dashboard/job-fit', label: 'Job Fit' },
  { href: '/dashboard/community', label: 'Community' },
  { href: '/dashboard/circle', label: 'The Circle' },
  { href: '/dashboard/hireability-report', label: 'My Report' },
  { href: '/dashboard/weekly-report', label: 'Weekly Report' },
  { href: '/dashboard/interview', label: 'Interview' },
  { href: '/dashboard/privacy', label: 'Privacy' },
]

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {LINKS.map((link) => {
        const isActive = link.href === '/dashboard' ? pathname === link.href : pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
