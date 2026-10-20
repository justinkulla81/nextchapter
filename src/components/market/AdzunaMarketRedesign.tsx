import Link from 'next/link'
import {
  histogramPercentile,
  histogramShareBelow,
  historyChangePct,
  type DemandByState,
  type DemandCount,
  type SalaryHistogram,
  type SalaryHistory,
  type TopCompanies,
} from '@/lib/market/adzuna-insights-core'
import { AdzunaAttribution } from '@/components/market/AdzunaAttribution'
import { MarketScopeToggle } from '@/components/market/MarketScopeToggle'
import { EmptyNote, PlainNote, SourceLine } from '@/components/candidate/Blocks'
import { cn } from '@/lib/utils'

// The advertised-pay chart in the redesign: serif sub-headings, one fact under each, reading-size text, ink bars.
// Presentational only, so the dev-preview can render it with sample data. AdzunaMarketSection loads the data and
// renders this when it is asked for the redesign; its legacy markup is untouched.

function money(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`
}

function monthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

function Bar({ value, max, highlight }: { value: number; max: number; highlight?: boolean }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-2 flex-1 rounded-full bg-muted" aria-hidden>
      <div className={cn('h-2 rounded-full', highlight ? 'bg-ink' : 'bg-ink/30')} style={{ width: `${pct}%` }} />
    </div>
  )
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {children}
    </div>
  )
}

export function AdzunaMarketRedesign({
  role,
  placeLabel,
  stateName,
  stateScoped,
  targetCompMin,
  demand,
  histogram,
  history,
  top,
  geo,
}: {
  role: string
  placeLabel: string
  stateName: string | null
  stateScoped: boolean
  targetCompMin: number | null
  demand: DemandCount | null
  histogram: SalaryHistogram | null
  history: SalaryHistory | null
  top: TopCompanies | null
  geo: DemandByState | null
}) {
  const topStates = geo?.states.slice(0, 8) ?? []
  const memberStateRow = stateName ? geo?.states.find((s) => s.state === stateName) : undefined
  const memberStateRank = memberStateRow && geo ? geo.states.indexOf(memberStateRow) + 1 : null
  const stateRows = memberStateRow && !topStates.includes(memberStateRow) ? [...topStates, memberStateRow] : topStates
  const stateMax = Math.max(0, ...stateRows.map((s) => s.count))
  const anyData = histogram || history || top || demand || geo

  const p25 = histogram ? histogramPercentile(histogram, 0.25) : null
  const p50 = histogram ? histogramPercentile(histogram, 0.5) : null
  const p75 = histogram ? histogramPercentile(histogram, 0.75) : null
  const share = histogram && targetCompMin ? histogramShareBelow(histogram, targetCompMin) : null
  const change = history ? historyChangePct(history) : null
  const histMax = histogram ? Math.max(...histogram.buckets.map((b) => b.count)) : 0
  const trendMax = history ? Math.max(...history.points.map((p) => p.averageSalary)) : 0

  return (
    <div id="market-data" className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PlainNote>
          Live job-posting data for <span className="font-semibold">{role}</span> in {placeLabel}.
        </PlainNote>
        {stateName && <MarketScopeToggle stateName={stateName} current={stateScoped ? 'state' : 'us'} />}
      </div>

      {!anyData ? (
        <EmptyNote>
          Market data for {role} in {placeLabel} is not available yet. We refresh it in the background, so check back tomorrow.
        </EmptyNote>
      ) : (
        <>
          {demand && (
            <PlainNote>
              <span className="font-semibold tabular-nums">{demand.count.toLocaleString()}</span> open postings match this role in {placeLabel} right now.
            </PlainNote>
          )}

          <div className="grid gap-10 md:grid-cols-2">
            <Part title="What employers are advertising">
              {histogram ? (
                <>
                  {p25 !== null && p75 !== null && (
                    <PlainNote>
                      The middle half of advertised salaries runs <span className="font-semibold">{money(p25)} to {money(p75)}</span>
                      {p50 !== null && <>, with a midpoint near <span className="font-semibold">{money(p50)}</span></>}.
                    </PlainNote>
                  )}
                  <ul className="space-y-2" aria-label="Advertised salary distribution">
                    {histogram.buckets.map((b, i) => {
                      const next = histogram.buckets[i + 1]?.min
                      const label = next ? `${money(b.min)} to ${money(next)}` : `${money(b.min)} and up`
                      const inBucket = targetCompMin !== null && targetCompMin >= b.min && (next === undefined || targetCompMin < next)
                      return (
                        <li key={b.min} className="flex items-center gap-3 text-sm">
                          <span className="w-28 shrink-0 text-muted-foreground tabular-nums">{label}</span>
                          <Bar value={b.count} max={histMax} highlight={inBucket} />
                          <span className="w-14 shrink-0 text-right text-muted-foreground tabular-nums">{b.count.toLocaleString()}</span>
                        </li>
                      )
                    })}
                  </ul>
                  {share !== null && targetCompMin !== null && (
                    <PlainNote className="text-muted-foreground">
                      Your target minimum of {money(targetCompMin)} is above about {Math.round(share * 100)}% of advertised salaries for this role
                      {share > 0.75 ? ', so expect fewer postings to clear it and plan to negotiate from evidence.' : '.'}
                    </PlainNote>
                  )}
                  <SourceLine>Based on {histogram.total.toLocaleString()} postings that list a salary.</SourceLine>
                </>
              ) : (
                <EmptyNote>Not enough postings list a salary for this role yet to show a range.</EmptyNote>
              )}
            </Part>

            <Part title={history ? `Average advertised salary, last ${history.points.length} months` : 'Salary trend'}>
              {history ? (
                <>
                  {change !== null && (
                    <PlainNote>{Math.abs(change) < 1 ? 'Flat over this period.' : change > 0 ? `Up ${change}% over this period.` : `Down ${Math.abs(change)}% over this period.`}</PlainNote>
                  )}
                  <ul className="space-y-2" aria-label="Average advertised salary by month">
                    {history.points.map((p) => (
                      <li key={p.month} className="flex items-center gap-3 text-sm">
                        <span className="w-28 shrink-0 text-muted-foreground">{monthLabel(p.month)}</span>
                        <Bar value={p.averageSalary} max={trendMax} />
                        <span className="w-14 shrink-0 text-right text-muted-foreground tabular-nums">{money(p.averageSalary)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <EmptyNote>There is no salary history for this role yet.</EmptyNote>
              )}
            </Part>
          </div>

          <div className="grid gap-10 md:grid-cols-2">
            <Part title="Where the openings are">
              {stateRows.length === 0 ? (
                <EmptyNote>There is no state-by-state breakdown for this role yet.</EmptyNote>
              ) : (
                <>
                  {memberStateRank !== null && geo && (
                    <PlainNote>
                      {stateName} ranks number {memberStateRank} of {geo.states.length} states for this role.
                    </PlainNote>
                  )}
                  <ul className="space-y-2" aria-label="Open postings by state">
                    {stateRows.map((s) => (
                      <li key={s.state} className="flex items-center gap-3 text-sm">
                        <span className={cn('w-28 shrink-0 truncate', s.state === stateName ? 'font-semibold text-ink' : 'text-muted-foreground')}>{s.state}</span>
                        <Bar value={s.count} max={stateMax} highlight={s.state === stateName} />
                        <span className="w-14 shrink-0 text-right text-muted-foreground tabular-nums">{s.count.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Part>

            <Part title={`Who is hiring most in ${placeLabel}`}>
              {top ? (
                <>
                  <ol className="divide-y divide-border">
                    {top.companies.map((c, i) => (
                      <li key={c.name} className="flex items-baseline justify-between gap-3 py-2.5">
                        <span className="text-base text-ink">
                          <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                          {c.name}
                        </span>
                        <span className="text-sm text-muted-foreground tabular-nums">{c.count.toLocaleString()} open</span>
                      </li>
                    ))}
                  </ol>
                  <SourceLine>
                    Add any of these to your{' '}
                    <Link href="/dashboard/find-my-job" className="font-medium text-brand underline underline-offset-4">
                      Company Tracker
                    </Link>{' '}
                    to hear when they post.
                  </SourceLine>
                </>
              ) : (
                <EmptyNote>There is no hiring leaderboard for this role yet.</EmptyNote>
              )}
            </Part>
          </div>
        </>
      )}

      <AdzunaAttribution surface="market_reality" />
    </div>
  )
}
