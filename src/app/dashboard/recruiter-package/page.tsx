import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/candidate/PageHeader'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { Chip, PrimaryButton, SecondaryButton, Section } from '@/components/candidate/ui'
import { ExpressInterestButton } from '@/components/search-firms/ExpressInterestButton'
import { ShareWithFirmButton } from '@/components/dashboard/ShareWithFirmButton'
import { recommendedFirms } from '@/lib/recruiter-interest/server'
import { getFirmBriefs } from '@/lib/seo/search-firm-pages'

export const metadata: Metadata = { title: 'Your recruiter package' }

// The member's recruiter package: the firms they picked, which of them can receive it, and the steps that make it
// stronger. Three sections, one primary action (docs/candidate-redesign.md). Nothing here is sent to a firm until the
// member presses "Send my résumé"; a firm that has not joined holds nothing.
export default async function RecruiterPackagePage() {
  const profile = await getDashboardProfile()
  const [interests, resumeCount] = await Promise.all([
    prisma.recruiterInterest.findMany({
      where: { candidateId: profile.id, status: { not: 'WITHDRAWN' } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, firmOrgId: true },
    }),
    prisma.resume.count({ where: { candidateId: profile.id, looksLikeResume: { not: false } } }),
  ])
  const briefs = await getFirmBriefs(interests.map((i) => i.firmOrgId))
  const recs = resumeCount > 0 ? await recommendedFirms(profile.id, 5).catch(() => []) : []
  const hasResume = resumeCount > 0
  const nameOf = (i: (typeof interests)[number]) => briefs.get(i.firmOrgId)?.name ?? 'this firm'
  const joined = (i: (typeof interests)[number]) => briefs.get(i.firmOrgId)?.joined === true
  const readyToSend = interests.find((i) => i.status === 'HELD' && joined(i))

  // One primary action: the next thing that moves the package, in order.
  const primary = !hasResume
    ? <PrimaryButton href="/dashboard/resume">Add your résumé</PrimaryButton>
    : readyToSend
      ? <ShareWithFirmButton orgId={readyToSend.firmOrgId} firmName={nameOf(readyToSend)} />
      : <PrimaryButton href="/dashboard/market-reality">Start my assessment</PrimaryButton>

  return (
    <div className="space-y-10">
      <PageHeader
        title="Your recruiter package"
        intro="Your résumé and what backs it up, for the search firms you picked. A firm sees it only when you send it."
        action={primary}
      />

      <Section id="firms" title="Firms you picked">
        {interests.length === 0 ? (
          <EmptyCard
            title="No firms yet"
            why="Pick a search firm and its recruiters can see your package once you send it. You can pick as many as you like."
            action={<SecondaryButton href="/search-firms">Browse search firms</SecondaryButton>}
          />
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {interests.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="max-w-xl">
                  <p className="text-base font-semibold text-ink">{nameOf(i)}</p>
                  <p className="text-sm text-muted-foreground">
                    {i.status === 'SHARED'
                      ? 'You sent your résumé. The firm sees what you chose to share.'
                      : joined(i)
                        ? 'This firm is on NextChapter. Nothing has been sent yet.'
                        : 'This firm has not joined NextChapter yet. Nothing has been sent. If it joins, you choose then.'}
                  </p>
                </div>
                {i.status === 'SHARED' ? <Chip tone="good">Sent</Chip> : joined(i) && hasResume ? <ShareWithFirmButton orgId={i.firmOrgId} firmName={nameOf(i)} /> : <Chip>Held</Chip>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {recs.length > 0 && (
        <Section id="recs" title="More firms that fit you">
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {recs.map((f) => (
              <li key={f.orgId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="max-w-xl">
                  <Link href={`/search-firms/${f.slug}`} className="text-base font-semibold text-ink hover:underline">{f.name}</Link>
                  <p className="text-sm text-muted-foreground">Fits because it {f.reasons.slice(0, 2).join(' and ')}.</p>
                </div>
                <ExpressInterestButton orgId={f.orgId} firmName={f.name} source="recommendation" />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section id="build" title="Make the package stronger">
        <ul className="divide-y divide-border rounded-2xl border-y border-border">
          {[
            ['Market Reality Assessment', '15 minutes. Gives you a grade recruiters trust.', '/dashboard/market-reality', 'Start my assessment'],
            ['Skills assessment', '20 minutes. Shows what you can do in a form recruiters can compare.', '/dashboard/skills-assessment', 'Start skills assessment'],
            ['References', 'Name three people. NextChapter collects the references for you.', '/dashboard/references', 'Ask for references'],
            ['Résumé', 'We check it for missing results and unclear dates.', '/dashboard/resume', 'Fix my résumé'],
            ['Community', 'Talk with members in your industry and function.', '/dashboard/community', 'Open the community'],
          ].map(([t, why, href, label]) => (
            <li key={t} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="max-w-xl"><p className="text-base font-semibold text-ink">{t}</p><p className="text-sm text-muted-foreground">{why}</p></div>
              <SecondaryButton href={href}>{label}</SecondaryButton>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
