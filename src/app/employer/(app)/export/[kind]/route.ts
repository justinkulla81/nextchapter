import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOutplacementRole } from '@/lib/employer/outplacement-auth'
import { getOrgRoster } from '@/lib/employer/outplacement-roster'
import { getEngagementAggregates, getSeatUtilization, getTimeToPlacementBenchmarks } from '@/lib/employer/outplacement-reporting'
import { csvResponse, datedName } from '@/lib/partners/csv-response'
import { recordPartnerAudit } from '@/lib/partners/audit'

// Downloads for the outplacement portal. The roster is the organization's own enrollment
// input (what an administrator typed in); the reporting summary carries only the
// aggregates the Reporting page already shows, with the same small-group suppression.
// Neither goes further than the page it mirrors.
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  if (kind === 'roster') {
    const orgUser = await requireOutplacementRole(['ADMIN'])
    const seats = await getOrgRoster(orgUser)
    await recordPartnerAudit({ portal: 'OUTPLACEMENT', refId: orgUser.orgId, actorUserId: orgUser.userId, actorLabel: orgUser.email, action: 'export.roster', detail: { rows: seats.length } })
    return csvResponse(
      datedName('roster'),
      seats.map((s) => ({
        name: s.invitedName,
        email: s.invitedEmail,
        status: s.status.toLowerCase(),
        cohort: s.cohort,
        package: s.packageKey,
        enrolled: s.enrolledAt,
        activated: s.activatedAt,
        access_ends: s.access.endsAt,
      })),
      'No one is enrolled yet.',
    )
  }
  if (kind === 'reporting') {
    const orgUser = await requireOutplacementRole(['ADMIN', 'VIEWER'])
    const contracts = await prisma.outplacementContract.findMany({ where: { orgId: orgUser.orgId }, orderBy: { createdAt: 'desc' } })
    const rows: Record<string, unknown>[] = []
    for (const c of contracts) {
      const [util, engagement] = await Promise.all([getSeatUtilization(orgUser, c.id), getEngagementAggregates(orgUser, c.id)])
      const base = { contract: c.cohortLabel ?? c.id, tier: c.tier, as_of: util?.scope.asOf ?? null, reporting: util?.scope.granularity ?? null }
      const metric = (name: string, value: number | null | undefined) => rows.push({ ...base, metric: name, value: value ?? 'withheld: group too small' })
      metric('Seats', util?.totalSeats)
      metric('Activated seats', util?.activatedSeats)
      metric('Activation rate (%)', util?.activationRatePct)
      metric('Checked in, last 7 days (%)', engagement?.checkedInLast7DaysPct)
    }
    const bench = await getTimeToPlacementBenchmarks(orgUser)
    await recordPartnerAudit({ portal: 'OUTPLACEMENT', refId: orgUser.orgId, actorUserId: orgUser.userId, actorLabel: orgUser.email, action: 'export.reporting', detail: { contracts: contracts.length } })
    void bench
    return csvResponse(datedName('reporting-summary'), rows, 'No contracts yet.')
  }
  return NextResponse.json({ error: 'Unknown download.' }, { status: 404 })
}
