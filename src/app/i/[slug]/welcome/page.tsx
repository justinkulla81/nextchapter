import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { readableTextOn } from '@/lib/higher-ed/branding'
import { findMemberByEmail, findMemberByToken } from '@/lib/higher-ed/join'
import { InstitutionMark } from '@/components/higher-ed/InstitutionMark'
import { WelcomeForm } from '@/components/higher-ed/WelcomeForm'
import { completeWelcome } from './actions'

export const metadata: Metadata = { robots: { index: false, follow: false } }

// Step 2 of 3: who sees what, and "I'll take a call". Then their grade.
export default async function WelcomePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string }> }) {
  const { slug } = await params
  const { t } = await searchParams
  const user = await getCurrentUser()
  if (!user?.email) redirect(`/auth/login?next=${encodeURIComponent(`/i/${slug}/welcome${t ? `?t=${t}` : ''}`)}`)
  const inst = await prisma.institution.findUnique({
    where: { slug },
    select: { id: true, name: true, programBrandName: true, logoUrl: true, accentColor: true, orgType: true },
  })
  if (!inst) notFound()
  const byToken = t ? await findMemberByToken(slug, t) : null
  const member = byToken && byToken.email === user.email.toLowerCase() ? byToken : await findMemberByEmail(inst.id, user.email)
  if (member?.candidateId && (member.status === 'CLAIMED' || member.status === 'ACTIVE')) redirect(`/i/${slug}/candidate`)
  const accent = inst.accentColor ?? '#2e7d5b'

  return (
    <div className="min-h-screen bg-background" style={{ ['--primary' as string]: accent, ['--primary-foreground' as string]: readableTextOn(accent) }}>
      <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
        <div className="flex items-center gap-3">
          <InstitutionMark name={inst.name} logoUrl={inst.logoUrl} />
          <p className="font-semibold">{inst.programBrandName ?? inst.name}</p>
        </div>
        {member ? (
          <>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Welcome{member.firstName ? `, ${member.firstName}` : ''}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{inst.orgType === 'COLLEGE' ? 'Two choices' : 'A few choices'} about what {inst.name} sees. You can change them any time.</p>
            </div>
            <WelcomeForm action={completeWelcome.bind(null, slug, t ?? null)} collegeName={inst.name} workforce={inst.orgType !== 'COLLEGE'} />
          </>
        ) : (
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">We couldn&apos;t find you on {inst.name}&apos;s list</h1>
            <p className="text-sm text-muted-foreground">
              You&apos;re signed in as {user.email}. If {inst.name} has a different email for you, sign in with that one, or ask{' '}
              {inst.orgType === 'COLLEGE' ? 'the alumni office' : inst.name} to add this address.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
