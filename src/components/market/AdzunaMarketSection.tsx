import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  getDemandByState,
  getDemandCount,
  getSalaryHistogram,
  getSalaryHistory,
  getTopHiringCompanies,
  histogramPercentile,
  histogramShareBelow,
  historyChangePct,
  memberMarketRole,
  resolveState,
  type SalaryHistogram,
  type SalaryHistory,
} from '@/lib/market/adzuna-insights'
import { AdzunaAttribution } from '@/components/market/AdzunaAttribution'
import { MarketScopeToggle } from '@/components/market/MarketScopeToggle'
import { InlineLoadingState } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

function money(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`
}

function monthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>
}

function Bar({ value, max, highlight }: { value: number; max: number; highlight?: boolean }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-2 flex-1 rounded-full bg-muted" aria-hidden>
      <div className={cn('h-2 rounded-full', highlight ? 'bg-foreground' : 'bg-foreground/40')} style={{ width: `${pct}%` }} />
    </div>
  )
}

function SalaryDistribution({ h, targetMin }: { h: SalaryHistogram; targetMin: number | null }) {
  const max = Math.max(...h.buckets.map((b) => b.count))
  const p25 = histogramPercentile(h, 0.25)
  const p50 = histogramPercentile(h, 0.5)
  const p75 = histogramPercentile(h, 0.75)
  const share = targetMin ? histogramShareBelow(h, targetMin) : null
  return (
    <div className="space-y-3">
      <SubHeading>What employers are advertising</SubHeading>
      {p25 !== null && p75 !== null && (
        <p className="text-sm text-foreground">
          The middle half of advertised salaries runs <span className="font-semibold">{money(p25)}–{money(p75)}</span>
          {p50 !== null && <>, with a midpoint near <span className="font-semibold">{money(p50)}</span></>}.
        </p>
      )}
      <ul className="space-y-1.5" aria-label="Advertised salary distribution">
        {h.buckets.map((b, i) => {
          const next = h.buckets[i + 1]?.min
          const label = next ? `${money(b.min)}–${money(next)}` : `${money(b.min)}+`
          const inBucket = targetMin !== null && targetMin >= b.min && (next === undefined || targetMin < next)
          return (
            <li key={b.min} className="flex items-center gap-3 text-xs">
              <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{label}</span>
              <Bar value={b.count} max={max} highlight={inBucket} />
              <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">{b.count.toLocaleString()}</span>
            </li>
          )
        })}
      </ul>
      {share !== null && targetMin !== null && (
        <p className="text-sm text-muted-foreground">
          Your target minimum of {money(targetMin)} is above about {Math.round(share * 100)}% of advertised salaries for this
          role{share > 0.75 ? ' — expect fewer postings to clear it, and plan to negotiate from evidence.' : '.'}
        </p>
      )}
      <p className="text-xs text-muted-foreground">Based on {h.total.toLocaleString()} postings that list a salary.</p>
    </div>
  )
}

function SalaryTrend({ h }: { h: SalaryHistory }) {
  const change = historyChangePct(h)
  const max = Math.max(...h.points.map((p) => p.averageSalary))
  return (
    <div className="space-y-3">
      <SubHeading>Average advertised salary, last {h.points.length} months</SubHeading>
      {change !== null && (
        <p className="text-sm text-foreground">
          {Math.abs(change) < 1
            ? 'Flat over this period.'
            : change > 0
              ? `Up ${change}% over this period.`
              : `Down ${Math.abs(change)}% over this period.`}
        </p>
      )}
      <ul className="space-y-1.5" aria-label="Average advertised salary by month">
        {h.points.map((p) => (
          <li key={p.month} className="flex items-center gap-3 text-xs">
            <span className="w-24 shrink-0 text-muted-foreground">{monthLabel(p.month)}</span>
            <Bar value={p.averageSalary} max={max} />
            <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">{money(p.averageSalary)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AdzunaMarketSectionLoading() {
  return <InlineLoadingState label="Loading salary and demand data for your role…" className="mt-4" />
}

// "The market for your role" — Adzuna's advertised-salary distribution,
// 6-month salary trend, demand by state and top hiring companies for the
// member's target role, scoped to their state (or nationwide). Reads through
// the weekly shared cache in adzuna-insights.ts; render inside <Suspense>
// with AdzunaMarketSectionLoading as the fallback, since a cold cache calls
// Adzuna inline.
export async function AdzunaMarketSection({ candidateId, scope }: { candidateId: string; scope: 'state' | 'us' }) {
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { targetRoleType: true, targetFunction: true, primaryFunction: true, currentState: true, targetCompMin: true },
  })
  if (!candidate) return null

  const role = memberMarketRole(candidate)
  if (!role) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        Add your target role on your{' '}
        <Link href="/dashboard/profile" className="text-primary underline underline-offset-4">
          profile
        </Link>{' '}
        to see what employers are paying and who&apos;s hiring for it.
      </p>
    )
  }

  const stateName = resolveState(candidate.currentState)
  const stateScoped = scope === 'state' && stateName !== null
  const where = stateScoped ? stateName : null
  const placeLabel = where ?? 'the US'

  let results
  try {
    results = await Promise.all([
      getSalaryHistogram({ role, state: where }, { onMiss: 'fetch' }),
      getSalaryHistory({ role, state: where }, { onMiss: 'fetch' }),
      getTopHiringCompanies({ role, state: where }, { onMiss: 'fetch' }),
      getDemandCount({ role, state: where }, { onMiss: 'fetch' }),
      getDemandByState({ role }, { onMiss: 'fetch' }),
    ])
  } catch {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        We couldn&apos;t load market data for {role} just now. Reload the page in a few minutes to try again.
      </p>
    )
  }
  const [histogram, history, top, demand, geo] = results

  captureServerEvent(candidateId, 'market_data_viewed', {
    surface: 'market_reality',
    role,
    scope: stateScoped ? 'state' : 'us',
    state: stateName,
    hasHistogram: !!histogram.data,
    hasHistory: !!history.data,
    hasTopCompanies: !!top.data,
    hasDemandByState: !!geo.data,
  })

  const anyData = histogram.data || history.data || top.data || demand.data || geo.data
  const topStates = geo.data?.states.slice(0, 8) ?? []
  const memberStateRow = stateName ? geo.data?.states.find((s) => s.state === stateName) : undefined
  const memberStateRank = memberStateRow ? geo.data!.states.indexOf(memberStateRow) + 1 : null
  const stateRows = memberStateRow && !topStates.includes(memberStateRow) ? [...topStates, memberStateRow] : topStates
  const stateMax = Math.max(0, ...stateRows.map((s) => s.count))

  return (
    <div className="mt-4 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Live job-posting data for <span className="font-medium text-foreground">{role}</span> in {placeLabel}.
        </p>
        {stateName && <MarketScopeToggle stateName={stateName} current={stateScoped ? 'state' : 'us'} />}
      </div>

      {!anyData ? (
        <p className="text-sm text-muted-foreground">
          Market data for {role} in {placeLabel} isn&apos;t available yet. We refresh it in the background — check back
          tomorrow.
        </p>
      ) : (
        <>
          {demand.data && (
            <p className="text-sm text-foreground">
              <span className="font-semibold tabular-nums">{demand.data.count.toLocaleString()}</span> open postings match
              this role in {placeLabel} right now
              {demand.data.meanSalary ? <>, averaging {money(demand.data.meanSalary)} where a salary is listed</> : null}.
            </p>
          )}

          <div className="grid gap-8 md:grid-cols-2">
            {histogram.data ? (
              <SalaryDistribution h={histogram.data} targetMin={candidate.targetCompMin} />
            ) : (
              <div className="space-y-2">
                <SubHeading>What employers are advertising</SubHeading>
                <p className="text-sm text-muted-foreground">Not enough postings list a salary for this role yet.</p>
              </div>
            )}
            {history.data ? (
              <SalaryTrend h={history.data} />
            ) : (
              <div className="space-y-2">
                <SubHeading>Salary trend</SubHeading>
                <p className="text-sm text-muted-foreground">No salary history for this role yet.</p>
              </div>
            )}
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-3">
              <SubHeading>Where the openings are</SubHeading>
              {stateRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No state-by-state breakdown for this role yet.</p>
              ) : (
                <>
                  <ul className="space-y-1.5" aria-label="Open postings by state">
                    {stateRows.map((s) => (
                      <li key={s.state} className="flex items-center gap-3 text-xs">
                        <span className={cn('w-28 shrink-0 truncate', s.state === stateName ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                          {s.state}
                        </span>
                        <Bar value={s.count} max={stateMax} highlight={s.state === stateName} />
                        <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">{s.count.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                  {memberStateRank !== null && (
                    <p className="text-sm text-muted-foreground">
                      {stateName} ranks #{memberStateRank} of {geo.data!.states.length} states for this role.
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="space-y-3">
              <SubHeading>Who&apos;s hiring most in {placeLabel}</SubHeading>
              {top.data ? (
                <ol className="space-y-1.5 text-sm">
                  {top.data.companies.map((c, i) => (
                    <li key={c.name} className="flex items-baseline justify-between gap-3">
                      <span className="text-foreground">
                        <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</span>
                        {c.name}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{c.count.toLocaleString()} open</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No hiring leaderboard for this role yet.</p>
              )}
              {top.data && (
                <p className="text-xs text-muted-foreground">
                  Add any of these to your{' '}
                  <Link href="/dashboard/find-my-job" className="text-primary underline underline-offset-4">
                    Company Tracker
                  </Link>{' '}
                  to hear when they post.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      <AdzunaAttribution surface="market_reality" />
    </div>
  )
}
