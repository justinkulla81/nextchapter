import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { ClaimForm } from './ClaimForm'

export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Your free NextChapter profile' }

export default async function ClaimIntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const candidate = await prisma.intakeCandidate.findUnique({
    where: { claimToken: token },
    include: { connections: { where: { disconnectedAt: null }, include: { firm: { select: { name: true } } } } },
  })
  const expired = !candidate || (candidate.purgeAt && candidate.purgeAt < new Date())

  return (
    <main className="mx-auto max-w-xl space-y-6 px-6 py-16">
      <p className="text-sm font-medium text-muted-foreground">NextChapter</p>
      {expired ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">This link has expired</h1>
          <p className="text-muted-foreground">
            Unclaimed profiles are deleted after 60 days. You can still get a free market read and plan by{' '}
            <a href="/onboarding/desire" className="underline">
              starting here
            </a>
            .
          </p>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Your free NextChapter profile</h1>
            <p className="text-muted-foreground">
              {`${candidate.connections.map((c) => c.firm.name).join(' and ') || 'A search firm'} has your resume. `}
              Your free profile gives you a read on your job market and a plan for your search. You&apos;re never
              charged anything because of a recruiter connection.
            </p>
          </div>
          <ClaimForm
            token={token}
            email={candidate.email}
            claimed={!!candidate.claimedAt}
            connections={candidate.connections.map((c) => ({ id: c.id, firmName: c.firm.name, scopes: c.consentScopes }))}
          />
        </>
      )}
    </main>
  )
}
