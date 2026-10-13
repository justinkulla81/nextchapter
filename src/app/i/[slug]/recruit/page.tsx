import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { readableTextOn } from '@/lib/higher-ed/branding'
import { InstitutionMark } from '@/components/higher-ed/InstitutionMark'
import { RecruitButton } from '@/components/higher-ed/RecruitButton'

export const metadata: Metadata = { robots: { index: false, follow: false } }

// Where a college sends employers who want to hire its alumni: sign in with
// a NextChapter employer account, ask, and Career Services approves.
export default async function RecruitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const inst = await prisma.institution.findUnique({ where: { slug }, select: { id: true, name: true, programBrandName: true, logoUrl: true, accentColor: true } })
  if (!inst) notFound()
  const user = await getCurrentUser()
  const link = user
    ? await prisma.institutionEmployer.findFirst({
        where: { institutionId: inst.id, employerProfile: { OR: [{ userId: user.id }, { seats: { some: { userId: user.id, acceptedAt: { not: null } } } }] } },
        select: { status: true },
      })
    : null
  const accent = inst.accentColor ?? '#2e7d5b'
  return (
    <div className="min-h-screen bg-background" style={{ ['--primary' as string]: accent, ['--primary-foreground' as string]: readableTextOn(accent) }}>
      <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
        <div className="flex items-center gap-3">
          <InstitutionMark name={inst.name} logoUrl={inst.logoUrl} />
          <p className="font-semibold">{inst.programBrandName ?? inst.name}</p>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Hire {inst.name} alumni</h1>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Post roles only {inst.name} alumni see, and get featured at the top.</li>
          <li>Browse Dossiers from alumni who chose to share them with employers, and ask for an intro.</li>
          <li>Your company page in front of every alum using {inst.programBrandName ?? inst.name}.</li>
        </ul>
        {user ? (
          <RecruitButton slug={slug} college={inst.name} initial={link?.status ?? null} />
        ) : (
          <div className="space-y-2 text-sm">
            <p>Sign in with your NextChapter employer account (or create one), then come back to this page to ask.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/employer/login" className="font-medium text-primary hover:underline">
                Sign in as an employer
              </Link>
              <Link href="/employer/signup" className="font-medium text-primary hover:underline">
                Create an employer account
              </Link>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">powered by NextChapter</p>
      </main>
    </div>
  )
}
