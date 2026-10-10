import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { getAdzunaBudgetUsage, isAdzunaInsightsEnabled } from '@/lib/market/adzuna-insights'
import { AdzunaAttribution } from '@/components/market/AdzunaAttribution'
import { cn } from '@/lib/utils'

const SHOW = 300
const ENDPOINT_LABEL: Record<string, string> = {
  histogram: 'Salary histogram',
  history: 'Salary history',
  top_companies: 'Top companies',
  geodata: 'Demand by state',
  demand: 'Posting count',
}
const SORTS = [
  { key: 'hits', label: 'Most hit' },
  { key: 'recent', label: 'Recently used' },
  { key: 'fetched', label: 'Recently fetched' },
] as const

type Row = Awaited<ReturnType<typeof load>>[number]

function load(sort: (typeof SORTS)[number]['key']) {
  const orderBy =
    sort === 'hits'
      ? [{ hitCount: 'desc' as const }, { lastHitAt: 'desc' as const }]
      : sort === 'recent'
        ? [{ lastHitAt: { sort: 'desc' as const, nulls: 'last' as const } }]
        : [{ fetchedAt: 'desc' as const }]
  return prisma.adzunaInsightCache.findMany({
    orderBy,
    take: SHOW,
    select: {
      id: true,
      endpoint: true,
      queryKey: true,
      location: true,
      error: true,
      fetchedAt: true,
      refreshAfter: true,
      hitCount: true,
      lastHitAt: true,
      payload: true,
    },
  })
}

function fmt(d: Date | null): string {
  return d ? d.toISOString().slice(0, 16).replace('T', ' ') : '—'
}

// Adzuna labor-market statistics cache and API budget. Statistics are cached
// per endpoint + role + location and refreshed at most weekly; live calls
// stop at the budget below (stale cache is served instead). See
// src/lib/market/adzuna-insights-core.ts for the limits.
export default async function AdminAdzunaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin()
  const sp = await searchParams
  const sort = SORTS.find((s) => s.key === sp.sort)?.key ?? 'hits'
  const now = new Date()
  const [rows, usage, totals] = await Promise.all([
    load(sort),
    getAdzunaBudgetUsage(now),
    prisma.adzunaInsightCache.aggregate({ _count: true, _sum: { hitCount: true } }),
  ])

  const columns: AdminColumn<Row>[] = [
    { header: 'Data', className: 'px-3 py-2 font-medium whitespace-nowrap', render: (r) => ENDPOINT_LABEL[r.endpoint] ?? r.endpoint },
    { header: 'Role query', render: (r) => <span className="font-medium">{r.queryKey}</span> },
    { header: 'Location', render: (r) => (r.location === 'us' ? 'US' : r.location) },
    { header: 'Hits', className: 'px-3 py-2 font-medium text-right', render: (r) => <span className="tabular-nums">{r.hitCount}</span> },
    { header: 'Last used', render: (r) => fmt(r.lastHitAt) },
    { header: 'Fetched', render: (r) => fmt(r.fetchedAt) },
    {
      header: 'Next refresh',
      render: (r) => <span className={cn(r.refreshAfter < now && 'text-muted-foreground')}>{r.refreshAfter < now ? 'Due' : fmt(r.refreshAfter)}</span>,
    },
    {
      header: 'Status',
      render: (r) =>
        r.error ? (
          <span className="text-destructive">{r.payload ? `Stale — ${r.error}` : r.error}</span>
        ) : r.payload ? (
          'OK'
        ) : (
          <span className="text-muted-foreground">No data</span>
        ),
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Adzuna market data</h1>
        <p className="mt-1 text-muted-foreground">
          Salary distribution, salary history, top hiring companies, demand by state and posting counts from the Adzuna
          API, cached per role and location and refreshed at most weekly. {totals._count} cached queries,{' '}
          {(totals._sum.hitCount ?? 0).toLocaleString()} cache hits in total.
        </p>
        <p className="mt-2 text-sm">
          Member-facing surfaces (Market Reality section, comp-band fallback, Company Tracker top-hirer line):{' '}
          {isAdzunaInsightsEnabled() ? (
            <span className="font-semibold">on</span>
          ) : (
            <span className="font-semibold">
              off — set ADZUNA_INSIGHTS_ENABLED=true in Vercel once Adzuna&apos;s written consent for commercial use is in
            </span>
          )}
          .
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">API budget (UTC)</h2>
        <p className="text-sm text-muted-foreground">
          &ldquo;All calls&rdquo; counts every Adzuna request the app makes, including job search. Market data stops
          calling live when either row is full and serves the last cached answer instead. Adzuna&apos;s own limits:
          25/minute, 250/day, 1,000/week, 2,500/month.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium">Budget</th>
                {usage[0].periods.map((p) => (
                  <th key={p.period} className="px-3 py-2 font-medium capitalize">
                    This {p.period}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usage.map((u) => (
                <tr key={u.scope} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{u.scope === 'all' ? 'All calls' : 'Market data'}</td>
                  {u.periods.map((p) => (
                    <td key={p.period} className={cn('px-3 py-2 tabular-nums', p.used >= p.limit && 'font-semibold text-destructive')}>
                      {p.used} / {p.limit}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cached queries</h2>
        <nav aria-label="Sort cached queries" className="flex flex-wrap gap-2">
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={s.key === 'hits' ? '/support/admin/adzuna' : `/support/admin/adzuna?sort=${s.key}`}
              aria-current={sort === s.key ? 'page' : undefined}
              className={cn('rounded-md border border-border px-3 py-1 text-sm', sort === s.key ? 'bg-foreground text-background' : 'hover:bg-muted')}
            >
              {s.label}
            </Link>
          ))}
        </nav>
        {rows.length === SHOW && <p className="text-sm text-muted-foreground">Showing the first {SHOW}.</p>}
        <AdminDataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          emptyMessage="Nothing cached yet. Rows appear the first time a member opens their Market Reality Report."
        />
      </section>

      <AdzunaAttribution surface="admin" />
    </div>
  )
}
