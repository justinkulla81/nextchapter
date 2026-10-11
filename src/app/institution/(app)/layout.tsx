import type { Metadata } from 'next'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { getCurrentInstitutionUser } from '@/lib/institution/auth'
import { prisma } from '@/lib/prisma'
import { readBranding } from '@/lib/institution/branding'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function InstitutionAppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentInstitutionUser()
  const inst = await prisma.institution.findUniqueOrThrow({
    where: { id: user.institutionId },
    select: { accentColor: true, logoUrl: true, profile: true, isDemo: true },
  })
  const b = readBranding(inst)
  // The college's own colour replaces the NextChapter brand colour inside its portal.
  const style = b.accentColor ? ({ '--color-brand': b.accentColor } as CSSProperties) : undefined

  return (
    <div className="theme-partner min-h-screen" style={style}>
      {inst.isDemo && (
        <p className="bg-muted px-6 py-1.5 text-center text-xs text-muted-foreground">
          Demonstration workspace. Sample content, not a live customer.
        </p>
      )}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            {b.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.logoUrl} alt="" className="h-8 w-auto object-contain" />
            )}
            <p className="font-semibold text-foreground">{user.programBrandName ?? user.institutionName}</p>
          </div>
          <nav className="flex gap-4 text-sm">
            <Link href="/institution" className="text-muted-foreground hover:text-foreground">Overview</Link>
            <Link href="/institution/jobs" className="text-muted-foreground hover:text-foreground">Alumni jobs</Link>
            <Link href="/institution/companies" className="text-muted-foreground hover:text-foreground">Target companies</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      <footer className="mx-auto max-w-5xl px-6 pb-8 text-xs text-muted-foreground">Powered by NextChapter</footer>
    </div>
  )
}
