import { prisma } from '@/lib/prisma'
import { requireOutplacementRole } from '@/lib/employer/outplacement-auth'
import { getEngagementAggregates, getSeatUtilization } from '@/lib/employer/outplacement-reporting'
import { recordPartnerAudit } from '@/lib/partners/audit'
import { PrintButton } from '@/components/partners/PrintButton'

export const metadata = { title: 'Quarterly review' }

// A one-page summary an administrator can print or save as a PDF for their own
// leadership. Same aggregates, rounding and small-group suppression as the
// Reporting page; nothing about any individual.
export default async function QuarterlyReviewPage() {
  const orgUser = await requireOutplacementRole(['ADMIN', 'VIEWER'])
  const contracts = await prisma.outplacementContract.findMany({ where: { orgId: orgUser.orgId }, orderBy: { createdAt: 'desc' } })
  const rows = await Promise.all(
    contracts.map(async (c) => ({ c, util: await getSeatUtilization(orgUser, c.id), engagement: await getEngagementAggregates(orgUser, c.id) })),
  )
  await recordPartnerAudit({ portal: 'OUTPLACEMENT', refId: orgUser.orgId, actorUserId: orgUser.userId, actorLabel: orgUser.email, action: 'export.review' })
  const shown = (n: number | null | undefined, suffix = '') => (n == null ? 'Withheld, group too small' : `${n}${suffix}`)

  return (
    <article className="mx-auto max-w-3xl space-y-6 print:max-w-none">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Quarterly review</h1>
          <p className="text-sm text-muted-foreground">
            {orgUser.programBrandName ?? orgUser.orgName} · prepared {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <PrintButton />
      </header>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">There are no contracts yet, so there is nothing to summarize.</p>
      ) : (
        rows.map(({ c, util, engagement }) => (
          <section key={c.id} className="space-y-3 break-inside-avoid rounded-lg border border-border p-4">
            <h2 className="text-lg font-semibold">{c.cohortLabel ?? 'Program'}</h2>
            <dl className="grid gap-4 sm:grid-cols-4">
              {[
                ['Seats', shown(util?.totalSeats)],
                ['Activated', shown(util?.activatedSeats)],
                ['Activation rate', shown(util?.activationRatePct, '%')],
                ['Checked in, last 7 days', shown(engagement?.checkedInLast7DaysPct, '%')],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))
      )}
      <p className="text-xs text-muted-foreground">Figures for small groups are rounded or withheld so no individual can be identified. This review does not describe any person&apos;s job search.</p>
    </article>
  )
}
