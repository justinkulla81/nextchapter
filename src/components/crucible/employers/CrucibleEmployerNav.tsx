'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'
import { CrucibleWordmark } from '@/components/crucible/CrucibleWordmark'
import { signOutCrucibleEmployer } from './actions'

function SignOutButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="text-sm text-muted-foreground hover:text-foreground">
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}

const LINKS = [
  { href: '/noexperience/employers/candidates', label: 'Candidates' },
  { href: '/noexperience/employers/contests', label: 'Contests' },
]

// Only two destinations in v1 — a plain top bar rather than /talent's
// fixed-sidebar-with-mobile-drawer nav, which is scaled for a much longer
// link list.
export function CrucibleEmployerNav() {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/noexperience/employers/candidates">
          <CrucibleWordmark className="text-lg" />
        </Link>
        <nav className="flex items-center gap-6">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors',
                isActive(link.href) ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
          <form action={signOutCrucibleEmployer}>
            <SignOutButton />
          </form>
        </nav>
      </div>
    </header>
  )
}
