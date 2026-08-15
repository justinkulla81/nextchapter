import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireOutplacementRole } from '@/lib/employer/outplacement-auth'
import {
  getSeatUtilization,
  getEngagementAggregates,
  getTimeToPlacementBenchmarks,
  getAlumniSentiment,
  getBoomerangSignal,
} from '@/lib/employer/outplacement-reporting'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const TIER_LABEL: Record<string, string> = { CORE: 'Core', PLUS: 'Plus', PREMIUM: 'Premium' }
const MOOD_LABEL: Record<string, string> = {
  STUCK: 'Stuck',
  GETTING_THERE: 'Getting there',
  MOVING: 'Moving',
  FIRED_UP: 'Fired up',
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

export default async function EmployerReportingPage({
  searchParams,
}: {
  searchParams: Promise<{ contractId?: string }>
}) {
  const orgUser = await requireOutplacementRole(['ADMIN', 'VIEWER'])
  const params = await searchParams

  const contracts = await prisma.outplacementContract.findMany({
    where: { orgId: orgUser.orgId },
    orderBy: { createdAt: 'desc' },
  })

  if (contracts.length === 0) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Reporting</h1>
        <p className="text-sm text-muted-foreground">No contracts on file yet.</p>
      </div>
    )
  }

  const activeContract = contracts.find((c) => c.id === params.contractId) ?? contracts[0]

  const [utilization, engagement, benchmarks, sentiment, boomerang] = await Promise.all([
    getSeatUtilization(orgUser, activeContract.id),
    getEngagementAggregates(orgUser, activeContract.id),
    getTimeToPlacementBenchmarks(orgUser),
    getAlumniSentiment(orgUser),
    getBoomerangSignal(orgUser),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reporting</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aggregate only — no individual is ever identifiable from these numbers. Cohorts under 10 seats
          are suppressed entirely; under 50 seats, numbers round to the nearest 5; under 20 seats, this
          section reports quarterly instead of live.
        </p>
      </div>

      {contracts.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {contracts.map((c) => (
            <Link
              key={c.id}
              href={`/employer/reporting?contractId=${c.id}`}
              className={cn(
                'rounded-full border px-3 py-1 text-sm',
                c.id === activeContract.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted'
              )}
            >
              {c.cohortLabel ?? `${TIER_LABEL[c.tier]} — ${c.seatCount} seats`}
            </Link>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {activeContract.cohortLabel ?? TIER_LABEL[activeContract.tier]}
            {utilization?.scope.granularity === 'quarterly' && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                Quarterly reporting
              </span>
            )}
          </CardTitle>
          <CardDescription>
            {TIER_LABEL[activeContract.tier]} · {activeContract.seatCount} seats · as of{' '}
            {utilization?.scope.asOf.toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {utilization && !utilization.suppressed ? (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Stat label="Seats" value={String(utilization.totalSeats ?? '—')} />
              <Stat label="Activated" value={String(utilization.activatedSeats ?? '—')} />
              <Stat label="Activation rate" value={utilization.activationRatePct != null ? `${utilization.activationRatePct}%` : '—'} />
              <Stat
                label="Engagement"
                value={engagement && engagement.population > 0 ? `${engagement.checkedInLast7DaysPct ?? '—'}%` : '—'}
                note="checked in, last 7 days"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This cohort has fewer than 10 seats — too small to report without risking re-identifying a
              specific person. Suppressed entirely per policy, not rounded.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Time to placement, by function and level</CardTitle>
          <CardDescription>Across all cohorts for this account.</CardDescription>
        </CardHeader>
        <CardContent>
          {!benchmarks.hasEnoughData ? (
            <p className="text-sm text-muted-foreground">
              Not enough placement data yet to report a benchmark — this fills in as more people record a
              placement.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 font-medium">Function</th>
                    <th className="px-3 py-2 font-medium">Level</th>
                    <th className="px-3 py-2 font-medium">People</th>
                    <th className="px-3 py-2 font-medium">Avg. days to placement</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarks.rows.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2">{r.function}</td>
                      <td className="px-3 py-2">{r.level}</td>
                      <td className="px-3 py-2 tabular-nums">{r.n}</td>
                      <td className="px-3 py-2 tabular-nums">{r.avgDaysToPlacement}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Alumni sentiment</CardTitle>
            <CardDescription>Last 90 days of mood check-ins, across all cohorts.</CardDescription>
          </CardHeader>
          <CardContent>
            {!sentiment.hasEnoughData ? (
              <p className="text-sm text-muted-foreground">Fewer than 10 people enrolled — suppressed.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {sentiment.distribution.map((d) => (
                  <li key={d.mood} className="flex justify-between">
                    <span>{MOOD_LABEL[d.mood] ?? d.mood}</span>
                    <span className="tabular-nums">{d.count ?? '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Boomerang signal</CardTitle>
            <CardDescription>People marked placed who later re-engaged.</CardDescription>
          </CardHeader>
          <CardContent>
            {!boomerang.hasEnoughData ? (
              <p className="text-sm text-muted-foreground">Fewer than 10 people marked placed yet — suppressed.</p>
            ) : (
              <p className="text-2xl font-semibold tabular-nums">{boomerang.boomerangCount ?? '—'}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
