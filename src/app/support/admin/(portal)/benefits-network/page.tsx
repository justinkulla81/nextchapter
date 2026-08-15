import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { delistBenefitsNetworkListing, relistBenefitsNetworkListing, reviewBenefitsNetworkReport } from './actions'
import { SubmitButton } from '@/components/ui/submit-button'

export const metadata = { title: 'Benefits Network — Admin' }

// A listing this poorly rated, with enough ratings to mean something, is
// surfaced for a human delisting decision — §A4.4 "delist on sustained poor
// feedback" is explicitly NOT automatic.
const POOR_RATING_THRESHOLD = 2.5
const MIN_RATINGS_FOR_REVIEW = 3

export default async function BenefitsNetworkAdminPage() {
  await requireAdmin()

  const [listings, openReports] = await Promise.all([
    prisma.benefitsNetworkListing.findMany({
      include: {
        alum: { select: { firstName: true, lastName: true, email: true } },
        ratings: { select: { rating: true } },
        _count: { select: { ratings: true, redemptions: true, reports: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.benefitsNetworkReport.findMany({
      where: { status: 'OPEN' },
      include: { listing: { select: { programName: true, institutionName: true } }, reportedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const withRatings = listings.map((l) => ({
    ...l,
    avgRating: l.ratings.length > 0 ? l.ratings.reduce((s, r) => s + r.rating, 0) / l.ratings.length : null,
  }))
  const reviewCandidates = withRatings.filter(
    (l) => l.avgRating != null && l.avgRating <= POOR_RATING_THRESHOLD && l._count.ratings >= MIN_RATINGS_FOR_REVIEW && l.status === 'LISTED'
  )

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alumni Benefits Network</h1>
        <p className="mt-1 text-muted-foreground">
          Master Build Script §A4.4 guardrails — delisting, member reports, and sustained-poor-feedback review all
          live here. Nothing auto-delists; every removal is a human decision.
        </p>
      </div>

      {reviewCandidates.length > 0 && (
        <section className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-4">
          <h2 className="font-semibold text-warning">Review for delisting — sustained poor feedback</h2>
          <ul className="space-y-1 text-sm">
            {reviewCandidates.map((l) => (
              <li key={l.id}>
                {l.programName} ({l.institutionName}) — {l.avgRating?.toFixed(1)}/5 avg across {l._count.ratings} ratings
              </li>
            ))}
          </ul>
        </section>
      )}

      {openReports.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Open reports ({openReports.length})</h2>
          <div className="space-y-2">
            {openReports.map((report) => (
              <div key={report.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                <div>
                  <p className="font-medium">
                    {report.listing.programName} ({report.listing.institutionName})
                  </p>
                  <p className="text-muted-foreground">
                    Reported by {[report.reportedBy.firstName, report.reportedBy.lastName].filter(Boolean).join(' ') || 'a member'}
                    {report.reason ? ` — "${report.reason}"` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={reviewBenefitsNetworkReport.bind(null, report.id, 'REVIEWED')}>
                    <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">
                      Mark reviewed
                    </SubmitButton>
                  </form>
                  <form action={reviewBenefitsNetworkReport.bind(null, report.id, 'DISMISSED')}>
                    <SubmitButton size="sm" variant="ghost" pendingLabel="Saving…">
                      Dismiss
                    </SubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">All listings ({listings.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                <th className="py-2 pr-3">Program</th>
                <th className="py-2 pr-3">Alum</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Rating</th>
                <th className="py-2 pr-3">Redemptions</th>
                <th className="py-2 pr-3">Expires</th>
                <th className="py-2 pr-3">Reports</th>
                <th className="py-2 pr-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {withRatings.map((l) => (
                <tr key={l.id} className="border-b border-border/60">
                  <td className="py-2 pr-3">
                    <p className="font-medium">{l.programName}</p>
                    <p className="text-xs text-muted-foreground">{l.institutionName}</p>
                  </td>
                  <td className="py-2 pr-3">
                    {[l.alum.firstName, l.alum.lastName].filter(Boolean).join(' ') || l.alum.email || '—'}
                  </td>
                  <td className="py-2 pr-3">{l.status}</td>
                  <td className="py-2 pr-3">{l.avgRating != null ? `${l.avgRating.toFixed(1)} (${l._count.ratings})` : '—'}</td>
                  <td className="py-2 pr-3">{l._count.redemptions}</td>
                  <td className="py-2 pr-3">{new Date(l.expiresAt).toLocaleDateString()}</td>
                  <td className="py-2 pr-3">{l._count.reports}</td>
                  <td className="py-2 pr-3">
                    {l.status === 'DELISTED' || l.status === 'EXPIRED' ? (
                      <form action={relistBenefitsNetworkListing.bind(null, l.id)}>
                        <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">
                          Re-list
                        </SubmitButton>
                      </form>
                    ) : l.status === 'LISTED' ? (
                      <form action={delistBenefitsNetworkListing.bind(null, l.id)}>
                        <SubmitButton size="sm" variant="destructive" pendingLabel="Delisting…">
                          Delist
                        </SubmitButton>
                      </form>
                    ) : (
                      <span className="text-xs text-muted-foreground">Awaiting institutional verification</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
