import type { Metadata } from 'next'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { ReferenceRequestForm } from '@/components/references/ReferenceRequestForm'
import { ReferenceDisputeControl } from '@/components/references/ReferenceDisputeControl'
import { ReferenceQuoteReview } from '@/components/references/ReferenceQuoteReview'
import { RELATIONSHIP_TYPE_LABELS } from '@/lib/constants/references'
import type { ReferenceStatus } from '@prisma/client'
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import { aggregatePerformance } from '@/lib/references/aggregate-performance'
import { computeRequiredMix } from '@/lib/references/required-mix'
import { ReferenceCheckSummary } from '@/components/references/ReferenceCheckSummary'
import { ReferenceFollowUpLink } from '@/components/references/ReferenceFollowUpLink'
import { referenceStatusText, referencesIntro } from '@/lib/redesign/network-pages'
import { captureServerEvent } from '@/lib/posthog/server'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Section } from '@/components/candidate/ui'
import { RowList } from '@/components/candidate/ListRow'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { ShowMore } from '@/components/candidate/ShowMore'

export const metadata: Metadata = { title: 'My References' }

// Real testimony is one of the strongest signals a hiring manager sees —
// 3 solid references reads as a strong pattern, not a one-off, so that's
// the lifetime target shown next to "Add a reference" in the Action Plan
// box (see SprintActionCompletion's lifetimeProgress prop). Matches
// DOSSIER_UNLOCK_REFERENCE_TARGET. Not a Candidate+ gate since 2026-10-16:
// references count toward Candidate+ Verified (evidence score).
const REFERENCE_TARGET_COUNT = 3

// Only these two statuses are still realistically awaiting a response —
// DECLINED/EXPIRED have nothing left to follow up on.
const AWAITING_RESPONSE_STATUSES: ReferenceStatus[] = ['REQUESTED', 'REMINDER_SENT']

function followUpBody(refereeName: string, candidateName: string) {
  return `Hi ${refereeName},\n\nJust following up on the reference request I sent — would really appreciate it whenever you have a few minutes!\n\nThanks,\n${candidateName}`
}

export default async function ReferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; email?: string }>
}) {
  const [profile, params] = await Promise.all([getDashboardData(), searchParams])

  const [pendingQuotes, workHistoryEntries] = await Promise.all([
    prisma.referenceQuote.findMany({
      where: { candidateId: profile.id, approvedByCandidateAt: null, rejectedAt: null },
      include: { reference: { select: { refereeName: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.workHistoryEntry.findMany({
      where: { candidateId: profile.id },
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
      select: { id: true, companyName: true, roleTitle: true },
    }),
  ])

  const candidateName = profile.displayName || 'me'
  const providedReferences = profile.references.filter((r) => r.status === 'COMPLETED')
  const performanceAggregate = aggregatePerformance(providedReferences)
  const mix = computeRequiredMix(providedReferences.map((r) => r.relationshipType))

  const allReferences = [...profile.references].sort(
    (a, b) => b.requestedAt.getTime() - a.requestedAt.getTime()
  )
  const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  // The redesign (docs/candidate-redesign.md): ask, review, see where each request stands. The summary of what
  // references say about you sits behind Show more.
  captureServerEvent(profile.id, 'references_viewed', {
    total: allReferences.length,
    completed: providedReferences.length,
    pendingQuotes: pendingQuotes.length,
  })
  return (
    <div className="space-y-8">
      <PageHeader
        title="References"
        intro={referencesIntro(providedReferences.length, REFERENCE_TARGET_COUNT)}
        action={
          <TrackedAction variant="primary" href="#send-request" event="reference_ask_started" properties={{ source: 'references_primary', completed: providedReferences.length }}>
            Ask someone
          </TrackedAction>
        }
      />
      <ReferenceQuoteReview
        quotes={pendingQuotes.map((q) => ({
          id: q.id,
          theme: q.theme,
          quoteText: q.quoteText,
          refereeName: q.reference.refereeName,
        }))}
      />
      <div id="send-request" className="scroll-mt-4">
        <Section id="ask" title="Ask for a reference">
          <ReferenceRequestForm
            initialName={params.name}
            initialEmail={params.email}
            workHistoryEntries={workHistoryEntries}
            confidentialSearchMode={profile.confidentialSearchMode}
          />
        </Section>
      </div>
      <div id="reference-status" className="scroll-mt-4">
        <Section id="status" title="Where your requests stand">
          {allReferences.length === 0 ? (
            <EmptyCard title="No requests yet" why="Even one or two real references make your search more believable to a hiring manager. Ask someone who has seen your work up close." />
          ) : (
            <RowList label="Your references">
              {allReferences.map((ref) => (
                <li key={ref.id} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-base font-semibold text-ink">{ref.refereeName}</p>
                      <p className="text-sm text-ink">{referenceStatusText(ref.status)}</p>
                      <p className="text-sm text-muted-foreground">
                        {RELATIONSHIP_TYPE_LABELS[ref.relationshipType]}
                        {ref.refereeCompany ? ` · ${ref.refereeCompany}` : ''} · Sent {dateFormatter.format(ref.requestedAt)}
                      </p>
                    </div>
                    {AWAITING_RESPONSE_STATUSES.includes(ref.status) && (
                      <ReferenceFollowUpLink
                        referenceId={ref.id}
                        href={gmailComposeHref(
                          ref.refereeEmail,
                          `Following up on your reference for ${candidateName}`,
                          followUpBody(ref.refereeName, candidateName)
                        )}
                      />
                    )}
                  </div>
                  {ref.status === 'COMPLETED' && (
                    <ReferenceDisputeControl
                      referenceId={ref.id}
                      disputeNote={ref.candidateDisputeNote}
                      disputedAt={ref.candidateDisputedAt}
                      resolvedAt={ref.disputeResolvedAt}
                    />
                  )}
                </li>
              ))}
            </RowList>
          )}
        </Section>
      </div>
      {providedReferences.length > 0 && (
        <ShowMore page="references" label="What your references say about you">
          <ReferenceCheckSummary
            dimensions={performanceAggregate.dimensions}
            completedReferenceCount={performanceAggregate.completedReferenceCount}
            confidenceTier={performanceAggregate.confidenceTier}
            mix={mix}
          />
        </ShowMore>
      )}
    </div>
  )
}
