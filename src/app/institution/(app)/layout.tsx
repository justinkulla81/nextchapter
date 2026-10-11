import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentInstitutionUser } from '@/lib/institution/auth'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function InstitutionAppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentInstitutionUser()
  return (
    <div className="theme-partner min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <p className="font-semibold text-foreground">{user.programBrandName ?? user.institutionName}</p>
          <nav className="flex gap-4 text-sm">
            <Link href="/institution" className="text-muted-foreground hover:text-foreground">Overview</Link>
            <Link href="/institution/jobs" className="text-muted-foreground hover:text-foreground">Alumni jobs</Link>
            <Link href="/institution/companies" className="text-muted-foreground hover:text-foreground">Target companies</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  )
}
