import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { verifyClaim, firstNameOf } from '@/lib/crm/claim'
import { ClaimChoice } from '@/components/claim/ClaimChoice'
import { PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { captureServerEvent } from '@/lib/posthog/server'

// A personal link: never indexed.
export const metadata: Metadata = { title: 'Claim your profile', robots: { index: false, follow: false } }

export default async function ClaimPage({
  params, searchParams,
}: { params: Promise<{ personId: string }>; searchParams: Promise<{ sig?: string }> }) {
  const { personId } = await params
  const { sig } = await searchParams

  const person = verifyClaim(personId, sig)
    ? await prisma.crmPerson.findUnique({
        where: { id: personId },
        select: {
          fullName: true, firstName: true, candidateId: true, deletedAt: true,
          affiliations: { where: { isCurrent: true }, orderBy: [{ isPrimary: 'desc' }], take: 1, select: { title: true, org: { select: { name: true } } } },
        },
      })
    : null

  return (
    <div className="flex flex-1 flex-col">
      <PublicSiteHeader />
      <div className="mx-auto w-full max-w-xl px-6 py-16 text-center">
        {!person || person.deletedAt ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-navy">This link is not valid</h1>
            <p className="mt-4 text-muted-foreground">
              It may have been copied incompletely. Ask Justin for a new one, or start from the{' '}
              <Link href="/" className="underline">NextChapter home page</Link>.
            </p>
          </>
        ) : person.candidateId ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-navy">You already have a profile</h1>
            <p className="mt-4 text-muted-foreground">
              <Link href="/dashboard" className="underline">Go to your dashboard</Link> to pick up where you left off.
            </p>
          </>
        ) : (
          <Claimable personId={personId} sig={sig!} person={person} />
        )}
      </div>
    </div>
  )
}

function Claimable({
  personId, sig, person,
}: {
  personId: string
  sig: string
  person: { fullName: string; firstName: string | null; affiliations: { title: string | null; org: { name: string } }[] }
}) {
  const first = firstNameOf(person.fullName, person.firstName)
  const role = person.affiliations[0]
  captureServerEvent(personId, 'claim_page_viewed', { personId })
  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-widest text-brand">Claim your profile</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">{first}, your profile is ready.</h1>
      <p className="mt-3 text-lg text-muted-foreground">No resume needed.</p>

      {role && (
        <p className="mx-auto mt-8 max-w-sm rounded-lg border border-border p-4 text-sm">
          <span className="block text-xs text-muted-foreground">What we started with</span>
          <span className="font-medium">{person.fullName}</span>
          <span className="block text-muted-foreground">{[role.title, role.org.name].filter(Boolean).join(' at ')}</span>
        </p>
      )}

      <p className="mx-auto mt-8 max-w-md text-muted-foreground">
        Tell us where you are. We build your report from public market data and what you share, and you decide who ever sees it.
      </p>
      <div className="mt-6">
        <ClaimChoice personId={personId} sig={sig} />
      </div>
      <p className="mx-auto mt-6 max-w-md text-xs text-muted-foreground">
        If you are working, your search is confidential by default. Not you? Ignore this page and nothing happens.
      </p>
    </>
  )
}
