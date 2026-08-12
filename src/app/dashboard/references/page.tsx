import type { Metadata } from 'next'
import { Users } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { ReferenceRequestForm } from '@/components/references/ReferenceRequestForm'
import { ReferenceDisputeControl } from '@/components/references/ReferenceDisputeControl'
import { ReferenceQuoteReview } from '@/components/references/ReferenceQuoteReview'
import { RELATIONSHIP_TYPE_LABELS } from '@/lib/constants/references'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import type { ReferenceStatus } from '@prisma/client'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import { aggregatePerformance } from '@/lib/references/aggregate-performance'
import { computeRequiredMix } from '@/lib/references/required-mix'
import { ReferenceCheckSummary } from '@/components/references/ReferenceCheckSummary'

export const metadata: Metadata = { title: 'My References' }

// Real testimony is one of the strongest signals a hiring manager sees —
// 3-5 solid references reads as a strong pattern, not a one-off, so that's
// the lifetime target shown next to "Add a reference" in the Action Plan
// box (see SprintActionCompletion's lifetimeProgress prop).
const REFERENCE_TARGET_COUNT = 5

const STATUS_STYLES: Record<ReferenceStatus, string> = {
  REQUESTED: 'bg-muted text-muted-foreground',
  REMINDER_SENT: 'bg-muted text-muted-foreground',
  COMPLETED: 'bg-primary/10 text-primary',
  DECLINED: 'bg-destructive/10 text-destructive',
  EXPIRED: 'bg-destructive/10 text-destructive',
}

const STATUS_LABELS: Record<ReferenceStatus, string> = {
  REQUESTED: 'Requested',
  REMINDER_SENT: 'Reminder sent',
  COMPLETED: 'Completed',
  DECLINED: 'Declined',
  EXPIRED: 'Expired',
}

// Only these two statuses are still realistically awaiting a response —
// DECLINED/EXPIRED have nothing left to follow up on.
const AWAITING_RESPONSE_STATUSES: ReferenceStatus[] = ['REQUESTED', 'REMINDER_SENT']

export default async function ReferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; email?: string }>
}) {
  const profile = await getDashboardData()
  const params = await searchParams

  const pendingQuotes = await prisma.referenceQuote.findMany({
    where: { candidateId: profile.id, approvedByCandidateAt: null, rejectedAt: null },
    include: { reference: { select: { refereeName: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const candidateName = profile.displayName || 'me'
  const providedReferences = profile.references.filter((r) => r.status === 'COMPLETED')
  const performanceAggregate = aggregatePerformance(providedReferences)
  const mix = computeRequiredMix(providedReferences.map((r) => r.relationshipType))

  const allReferences = [...profile.references].sort(
    (a, b) => b.requestedAt.getTime() - a.requestedAt.getTime()
  )
  const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">References</h1>
        <PageHeaderBoxes
          pageKey="references"
          candidateId={profile.id}
          lifetimeProgress={{
            REFERENCE_ADDED: { current: providedReferences.length, target: REFERENCE_TARGET_COUNT },
          }}
        />
      </div>

      <ReferenceQuoteReview
        quotes={pendingQuotes.map((q) => ({
          id: q.id,
          theme: q.theme,
          quoteText: q.quoteText,
          refereeName: q.reference.refereeName,
        }))}
      />

      <ReferenceRequestForm initialName={params.name} initialEmail={params.email} />

      <ReferenceCheckSummary
        dimensions={performanceAggregate.dimensions}
        completedReferenceCount={performanceAggregate.completedReferenceCount}
        confidenceTier={performanceAggregate.confidenceTier}
        confidenceLabel={performanceAggregate.confidenceLabel}
        mix={mix}
      />

      {profile.references.length === 0 && (
        <EmptyState
          icon={Users}
          title="No references requested yet"
          description="Use the form above to request your first one — even 1-2 real references make a real difference to your Current Market Reality."
        />
      )}

      {allReferences.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            All references ({allReferences.length})
          </h2>
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {allReferences.map((ref) => (
                <div key={ref.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-medium">{ref.refereeName}</p>
                      <p className="text-sm text-muted-foreground">
                        {RELATIONSHIP_TYPE_LABELS[ref.relationshipType]}
                        {ref.refereeCompany ? ` · ${ref.refereeCompany}` : ''}
                        {' · Sent '}
                        {dateFormatter.format(ref.requestedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {AWAITING_RESPONSE_STATUSES.includes(ref.status) && (
                        <a
                          href={gmailComposeHref(
                            ref.refereeEmail,
                            `Following up on your reference for ${candidateName}`,
                            `Hi ${ref.refereeName},\n\nJust following up on the reference request I sent — would really appreciate it whenever you have a few minutes!\n\nThanks,\n${candidateName}`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-primary underline underline-offset-4"
                        >
                          Follow up
                        </a>
                      )}
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                          STATUS_STYLES[ref.status]
                        )}
                      >
                        {STATUS_LABELS[ref.status]}
                      </span>
                    </div>
                  </div>
                  {ref.status === 'COMPLETED' && (
                    <ReferenceDisputeControl
                      referenceId={ref.id}
                      disputeNote={ref.candidateDisputeNote}
                      disputedAt={ref.candidateDisputedAt}
                      resolvedAt={ref.disputeResolvedAt}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
