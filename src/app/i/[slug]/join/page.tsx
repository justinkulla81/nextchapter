import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { readProfile } from '@/lib/higher-ed/profile'
import { readableTextOn } from '@/lib/higher-ed/branding'
import { findMemberByToken } from '@/lib/higher-ed/join'
import { InstitutionMark } from '@/components/higher-ed/InstitutionMark'
import { JoinButton } from '@/components/higher-ed/JoinButton'
import { CollegeSignIn } from '@/components/higher-ed/CollegeSignIn'
import { enabledProviders } from '@/lib/higher-ed/sso'

export const metadata: Metadata = { robots: { index: false, follow: false } }

// Public landing from the college's join email (spec §5.1 Claim / welcome).
// Step 1 of 3: one button. Step 2 is the welcome page; step 3 is their grade.
export default async function JoinPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string }> }) {
  const { slug } = await params
  const { t } = await searchParams
  const inst = await prisma.institution.findUnique({
    where: { slug },
    select: { name: true, programBrandName: true, logoUrl: true, accentColor: true, profile: true, orgType: true },
  })
  if (!inst) notFound()
  const member = t ? await findMemberByToken(slug, t) : null
  const providers = await enabledProviders()
  const profile = readProfile(inst.profile)
  const hero = profile.heroImageUrl ?? profile.photos?.[0]?.url ?? null
  const accent = inst.accentColor ?? '#2e7d5b'
  const brand = inst.programBrandName ?? inst.name
  const workforce = inst.orgType !== 'COLLEGE'

  return (
    <div className="min-h-screen bg-background" style={{ ['--primary' as string]: accent, ['--primary-foreground' as string]: readableTextOn(accent) }}>
      {hero && (
        // eslint-disable-next-line @next/next/no-img-element -- college-hosted or Wikimedia photo
        <img src={hero} alt="" className="h-48 w-full object-cover sm:h-64" />
      )}
      <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
        <div className="flex items-center gap-3">
          <InstitutionMark name={inst.name} logoUrl={inst.logoUrl} />
          <p className="font-semibold">{brand}</p>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {member?.firstName ? `${member.firstName}, ${inst.name} has your back` : `${inst.name} has your back`}
        </h1>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>A clear read on your job market, updated every week.</li>
          <li>A plan for this week, and coaching when you want it.</li>
          {workforce ? (
            <li>Local employers first, so you can find your next role close to home.</li>
          ) : (
            <li>Alumni who&apos;ll take your call, and jobs posted just for {inst.name} alumni.</li>
          )}
        </ul>
        <p className="text-sm text-muted-foreground">
          Free {workforce ? `from ${inst.name}` : `for ${inst.name} alumni`}. Your search stays yours: {inst.name} sees only what you choose to share, and you can change that any time.
        </p>
        {member && !member.tokenUsed ? (
          <JoinButton slug={slug} token={t!} label={`Join ${brand}`} />
        ) : member?.tokenUsed ? (
          <Link href={`/auth/login?next=${encodeURIComponent(`/i/${slug}/welcome`)}`} className="font-medium text-primary hover:underline">
            You&apos;ve joined already. Sign in
          </Link>
        ) : (
          <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
            <p>Sign in with the email {inst.name} has on file for you{workforce ? ' (the one you signed up with)' : ''}, and we&apos;ll find you on {workforce ? 'the list' : 'the alumni list'}.</p>
            <CollegeSignIn slug={slug} google={providers.google} microsoft={providers.microsoft} college={inst.name} workforce={workforce} />
            <Link href={`/auth/login?next=${encodeURIComponent(`/i/${slug}/welcome`)}`} className="font-medium text-primary hover:underline">
              Sign in to join
            </Link>
          </div>
        )}
        <p className="text-xs text-muted-foreground">powered by NextChapter</p>
      </main>
    </div>
  )
}
