'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'
import { signOutEmployer as signOut } from '@/app/auth/portal-sign-out'
import { PartnerTopBar, chromeFor } from '@/components/partners/PartnerTopBar'
import { employerUseForPath } from '@/lib/partners/portal-types'
import type { PartnerBrand } from '@/lib/partners/brand'
import type { OutplacementProgramType, OutplacementRole } from '@prisma/client'
import { SignOutForm } from '@/components/auth/SignOutForm'
import { SectionSwitcher, type SwitcherLinkItem } from '@/components/employer/SectionSwitcher'

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
}

// Every role sees Overview; everything else is per-role per §A7's
// role/permission table — this is the presentation layer only (hidden nav
// items), the real enforcement is requireOutplacementRole at each page/
// action (see src/lib/employer/outplacement-auth.ts's own comment on why
// both exist).
// Retention and Learning and development (the Employees section) show only for an org with that program.
function buildLinks(role: OutplacementRole, programs: OutplacementProgramType[], employeesOnly = false): NavLink[] {
  // A person who holds only the Employees section (no outplacement access) sees only its pages.
  if (employeesOnly) {
    const only: NavLink[] = []
    if (programs.includes('GROWTH')) only.push({ href: '/employer/growth', label: 'Retention' })
    if (programs.includes('LEARNING')) only.push({ href: '/employer/learning', label: 'Learning and development' })
    return only
  }
  const links: NavLink[] = [{ href: '/employer', label: 'Overview' }]
  if (role === 'ADMIN' || role === 'VIEWER') {
    if (programs.includes('GROWTH')) links.push({ href: '/employer/growth', label: 'Retention' })
    if (programs.includes('LEARNING')) links.push({ href: '/employer/learning', label: 'Learning and development' })
  }
  if (role === 'ADMIN') {
    links.push(
      { href: '/employer/enroll', label: 'Enroll' },
      { href: '/employer/roster', label: 'Roster' },
      { href: '/employer/program', label: 'Program' },
      { href: '/employer/reporting', label: 'Reporting' },
      { href: '/employer/invoices', label: 'Invoices' },
      { href: '/employer/team', label: 'Team' },
      { href: '/employer/activity', label: 'Downloads and activity' },
      { href: '/employer/connect', label: 'HR system and emails' }
    )
  } else if (role === 'VIEWER') {
    links.push({ href: '/employer/reporting', label: 'Reporting' }, { href: '/employer/activity', label: 'Downloads and activity' })
  } else if (role === 'LEGAL') {
    links.push({ href: '/employer/compliance', label: 'Compliance pack' })
  } else if (role === 'FINANCE') {
    links.push({ href: '/employer/invoices', label: 'Invoices' })
  }
  return links
}

function NavContent({ pathname, links, onNavigate, sections = [] }: { pathname: string; links: NavLink[]; onNavigate?: () => void; sections?: SwitcherLinkItem[] }) {
  const isActive = (href: string) => (href === '/employer' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`))

  return (
    <nav className="flex h-full flex-col gap-2 overflow-y-auto px-4 py-6">
      {/* The top bar carries the switcher from md up; the drawer carries it below that. */}
      <SectionSwitcher items={sections} className="flex-wrap px-2 pb-3 md:hidden" />
      <div className="space-y-0.5">
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
          </Link>
        ))}
      </div>
      <SignOutForm action={signOut} className="mt-auto px-2">
        <SignOutButton />
      </SignOutForm>
    </nav>
  )
}

export function EmployerNav({ role, brand, programs = [], sections = [], employeesOnly = false }: { role: OutplacementRole; brand?: PartnerBrand; programs?: OutplacementProgramType[]; sections?: SwitcherLinkItem[]; employeesOnly?: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const links = buildLinks(role, programs, employeesOnly)
  const current = links.find((link) => (link.href === '/employer' ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`)))

  return (
    <>
      <PartnerTopBar surface="employer" use={employerUseForPath(pathname)} brand={brand} switcher={<SectionSwitcher items={sections} />}>
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

      <aside className="fixed inset-y-0 top-14 left-0 z-30 hidden w-64 lg:block" style={{ backgroundColor: chromeFor('employer') }}>
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-accent-employer" style={brand?.accent ? { backgroundColor: brand.accent } : undefined} />
        <NavContent pathname={pathname} links={links} sections={sections} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 shadow-xl" style={{ backgroundColor: chromeFor('employer') }}>
            <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-accent-employer" style={brand?.accent ? { backgroundColor: brand.accent } : undefined} />
            <NavContent pathname={pathname} links={links} sections={sections} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
