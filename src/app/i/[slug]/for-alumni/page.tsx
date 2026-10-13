import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { readProfile } from '@/lib/higher-ed/profile'
import { readableTextOn } from '@/lib/higher-ed/branding'
import { memberCards, serviceSettingsFrom } from '@/lib/higher-ed/services'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'
import { InstitutionMark } from '@/components/higher-ed/InstitutionMark'
import { buttonVariants } from '@/components/ui/button'
import { CollegeSignIn } from '@/components/higher-ed/CollegeSignIn'
import { enabledProviders } from '@/lib/higher-ed/sso'

async function load(slug: string) {
  return prisma.institution.findUnique({
    where: { slug },
    select: { id: true, name: true, programBrandName: true, logoUrl: true, accentColor: true, profile: true, enabledFeatures: true, isDemo: true },
  })
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const inst = await load((await params).slug)
  if (!inst) return {}
  return {
    title: `${inst.name} has your back`,
    description: `Free career support for ${inst.name} alumni: a read on your job market, a plan, coaching and alumni who'll take your call.`,
    robots: inst.isDemo ? { index: false, follow: false } : undefined,
  }
}

// The public page a college links from its website and alumni magazine:
// what every alum gets, for any career move, and how to join. Numbers are
// counts, shown only once they're big enough to say nothing about anyone.
export default async function ForAlumniPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const inst = await load(slug)
  if (!inst) notFound()
  const profile = readProfile(inst.profile)
  const services = memberCards(serviceSettingsFrom(inst.enabledFeatures), ['alumni'])
  const [joined, landed] = await Promise.all([
    prisma.institutionMember.count({ where: { institutionId: inst.id, status: { in: ['CLAIMED', 'ACTIVE'] } } }),
    prisma.outcomeReport.count({ where: { member: { institutionId: inst.id }, shareMilestone: true } }),
  ])
  const providers = await enabledProviders()
  const accent = inst.accentColor ?? '#2e7d5b'
  const brand = inst.programBrandName ?? inst.name
  const hero = profile.heroImageUrl ?? profile.photos?.[0]?.url ?? null
  const moves = ['Laid off or between jobs', 'Ready for a new job, quietly', 'Going for a promotion', 'Changing careers', 'Returning after a break', 'Planning a next act']

  return (
    <div className="min-h-screen bg-background" style={{ ['--primary' as string]: accent, ['--primary-foreground' as string]: readableTextOn(accent) }}>
      {hero && (
        // eslint-disable-next-line @next/next/no-img-element -- college-hosted or Wikimedia photo
        <img src={hero} alt="" className="h-56 w-full object-cover sm:h-72" />
      )}
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-10">
        <div className="flex items-center gap-3">
          <InstitutionMark name={inst.name} logoUrl={inst.logoUrl} />
          <p className="font-semibold">{brand}</p>
        </div>
        <section className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">{inst.name} has your back, for every career move</h1>
          <p className="text-lg text-muted-foreground">
            {`Free for ${inst.name} alumni: a clear read on your job market, a plan for this week, coaching, and alumni who'll take your call. Your search stays yours; ${inst.name} sees only what you choose to share.`}
          </p>
          <div className="space-y-3">
            <Link href={`/auth/login?next=${encodeURIComponent(`/i/${slug}/welcome`)}`} className={buttonVariants({ size: 'lg' })}>
              Join with your alumni email
            </Link>
            <CollegeSignIn slug={slug} google={providers.google} microsoft={providers.microsoft} college={inst.name} />
          </div>
        </section>
        <section aria-labelledby="moves" className="space-y-3">
          <h2 id="moves" className="text-xl font-semibold">
            Whatever the move
          </h2>
          <ul className="grid gap-2 sm:grid-cols-3">
            {moves.map((m) => (
              <li key={m} className="rounded-lg border border-border bg-card p-3 text-sm">
                {m}
              </li>
            ))}
          </ul>
        </section>
        {services.length > 0 && (
          <section aria-labelledby="services" className="space-y-3">
            <h2 id="services" className="text-xl font-semibold">
              What&apos;s included
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {services.map((s) => (
                <li key={s.key} className="rounded-lg border border-border bg-card p-4">
                  <p className="font-medium">{s.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.pitch}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
        {(joined >= MIN_CELL_SIZE || landed >= MIN_CELL_SIZE) && (
          <section aria-label="So far" className="grid gap-3 sm:grid-cols-2">
            {joined >= MIN_CELL_SIZE && (
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-3xl font-semibold tabular-nums">{joined.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{inst.name} alumni have joined</p>
              </div>
            )}
            {landed >= MIN_CELL_SIZE && (
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-3xl font-semibold tabular-nums">{landed.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">shared that they landed their next role</p>
              </div>
            )}
          </section>
        )}
        <p className="text-xs text-muted-foreground">powered by NextChapter</p>
      </main>
    </div>
  )
}
