import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { AdminCollapsibleSection } from '@/components/admin/AdminCollapsibleSection'
import { CrmSelectAll } from '@/components/admin/CrmSelectAll'
import { PageSizePicker, readPageSize } from '@/components/admin/PageSizePicker'
import { WarnReviewBar, WarnSyncNowButton } from '@/components/admin/WarnReviewBar'
import { WarnAddManualForm } from '@/components/admin/WarnAddManualForm'
import { WarnCompanyReviewRow } from '@/components/admin/WarnCompanyReviewRow'
import { WarnMonthlyBarChart, type WarnMonthlyBar } from '@/components/admin/WarnMonthlyBarChart'
import { CompanyPriorityAndChro } from '@/components/admin/CompanyPriorityAndChro'
import { SortHeader, readSort } from '@/components/admin/SortHeader'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatDate } from '@/lib/crm/labels'

export const maxDuration = 60

const SORTS = ['employees', 'employer', 'state', 'industry', 'noticeDate', 'effectiveDate']

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export default async function WarnReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const state = sp.state ?? ''
  const status = sp.status ?? 'pending'
  const industry = sp.industry ?? ''
  const effAfter = sp.effAfter ?? ''
  const effBefore = sp.effBefore ?? ''
  const minSize = parseInt(sp.min ?? '', 10)
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const perPage = readPageSize(sp.per)
  const sort = readSort(sp, SORTS, { sort: 'employees', dir: 'desc' })

  const where: Prisma.WarnNoticeWhereInput = {
    ...(status === 'pending' ? { promotedAt: null, dismissedAt: null }
      : status === 'promoted' ? { promotedAt: { not: null } }
      : status === 'dismissed' ? { dismissedAt: { not: null } } : {}),
    ...(state ? { state } : {}),
    ...(industry ? { industry } : {}),
    ...(Number.isFinite(minSize) ? { employees: { gte: minSize } } : {}),
    ...(q ? { employer: { contains: q, mode: 'insensitive' } } : {}),
    ...(effAfter || effBefore
      ? { effectiveDate: { ...(effAfter ? { gte: new Date(effAfter) } : {}), ...(effBefore ? { lte: new Date(effBefore) } : {}) } }
      : {}),
  }

  const orderBy: Prisma.WarnNoticeOrderByWithRelationInput[] =
    sort.sort === 'employer' ? [{ employer: sort.dir }]
    : sort.sort === 'state' ? [{ state: { sort: sort.dir, nulls: 'last' } }]
    : sort.sort === 'industry' ? [{ industry: { sort: sort.dir, nulls: 'last' } }]
    : sort.sort === 'noticeDate' ? [{ noticeDate: { sort: sort.dir, nulls: 'last' } }]
    : sort.sort === 'effectiveDate' ? [{ effectiveDate: { sort: sort.dir, nulls: 'last' } }]
    : [{ employees: { sort: sort.dir, nulls: 'last' } }, { noticeDate: 'desc' }]

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1)
  const lastYearEnd = new Date(now.getFullYear(), 0, 1)
  const chartStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  const [total, rows, counts, industryCounts, runs, ambiguous, thisMonth, lastYear, topIndustries, monthlyRows, companyNames] =
    await Promise.all([
      prisma.warnNotice.count({ where }),
      prisma.warnNotice.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        include: { company: { select: { id: true, name: true, priority: true, chroName: true, chroEmail: true, chroLinkedinUrl: true } } },
      }),
      prisma.warnNotice.groupBy({ by: ['state'], _count: { _all: true }, where: { state: { not: null } } }),
      prisma.warnNotice.groupBy({ by: ['industry'], _count: { _all: true }, where: { industry: { not: null } } }),
      prisma.warnSyncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 4 }),
      prisma.warnNotice.findMany({
        where: { companyMatchStatus: 'AMBIGUOUS' },
        select: { id: true, employer: true, companyMatchCandidates: true },
        orderBy: { fetchedAt: 'desc' },
      }),
      prisma.warnNotice.aggregate({ where: { noticeDate: { gte: monthStart } }, _count: { _all: true }, _sum: { employees: true } }),
      prisma.warnNotice.aggregate({ where: { noticeDate: { gte: lastYearStart, lt: lastYearEnd } }, _count: { _all: true }, _sum: { employees: true } }),
      prisma.warnNotice.groupBy({
        by: ['industry'], where: { industry: { not: null } },
        _count: { _all: true }, _sum: { employees: true },
        orderBy: { _count: { industry: 'desc' } }, take: 10,
      }),
      prisma.warnNotice.findMany({ where: { noticeDate: { gte: chartStart } }, select: { noticeDate: true, employees: true } }),
      prisma.company.findMany({ select: { name: true }, orderBy: { name: 'asc' }, take: 5000 }),
    ])
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const params = {
    q, state, status, industry, effAfter, effBefore,
    min: Number.isFinite(minSize) ? String(minSize) : '',
    per: String(perPage), sort: sort.sort, dir: sort.dir,
  }
  const sortParams = { q, state, status, industry, effAfter, effBefore, min: params.min, per: String(perPage) }
  const stateHref = (s: string) => `/support/admin/crm/warn?${new URLSearchParams({ ...params, state: s, page: '1' })}`

  const monthlyBuckets: WarnMonthlyBar[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthlyBuckets.push({ month: `${d.getFullYear()}-${d.getMonth()}`, label: monthLabel(d), roles: 0, count: 0 })
  }
  const bucketIndex = new Map(monthlyBuckets.map((b, i) => [b.month, i]))
  for (const r of monthlyRows) {
    if (!r.noticeDate) continue
    const key = `${r.noticeDate.getFullYear()}-${r.noticeDate.getMonth()}`
    const idx = bucketIndex.get(key)
    if (idx === undefined) continue
    monthlyBuckets[idx].roles += r.employees ?? 0
    monthlyBuckets[idx].count += 1
  }

  return (
    <div className="space-y-4">
      <nav className="text-sm">
        <Link href="/support/admin/crm/leads" className="text-muted-foreground hover:underline">← All leads</Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Layoff notices</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            WARN filings from state labor departments — the legally required notice before a mass layoff.
            Eighteen states, synced every Monday. Four of them (California, Colorado, Florida, Maryland)
            publish an industry sector, so their knowledge-work filings become leads on their own. The rest
            publish a headcount but no sector, and there is no way to tell a software reduction from a
            cannery closure without one — so those wait here for you. Most real announcements never file a
            WARN notice at all (or won&apos;t for months), so anything heard about from a news article can be
            added by hand below too.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WarnAddManualForm companyNames={companyNames.map((c) => c.name)} />
          <WarnSyncNowButton />
        </div>
      </header>

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        Why WARN and not layoffs.fyi: that site embeds a private Airtable base whose data endpoint refuses
        access. WARN filings are public records, and they carry the <strong className="text-foreground">effective
        date</strong> — which is the number that decides when outreach lands, since reaching people before they
        leave is the whole point. Not every state can be synced: New York and North Carolina publish theirs as
        a Tableau dashboard with no data behind it, and roughly a dozen more post PDFs or render the list with
        JavaScript.
      </div>

      <AdminCollapsibleSection title="National stats" summary={`${total.toLocaleString()} notices on file`} defaultOpen>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">This month</p>
              <p className="mt-0.5 text-lg font-semibold">{(thisMonth._sum.employees ?? 0).toLocaleString()} roles</p>
              <p className="text-xs text-muted-foreground">{thisMonth._count._all.toLocaleString()} notices</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">{now.getFullYear() - 1} (last calendar year)</p>
              <p className="mt-0.5 text-lg font-semibold">{(lastYear._sum.employees ?? 0).toLocaleString()} roles</p>
              <p className="text-xs text-muted-foreground">{lastYear._count._all.toLocaleString()} notices</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="mb-1 text-xs text-muted-foreground">Top industries</p>
              <ol className="space-y-0.5 text-xs">
                {topIndustries.slice(0, 5).map((i) => (
                  <li key={i.industry} className="flex justify-between gap-2">
                    <span className="truncate text-muted-foreground">{i.industry}</span>
                    <span className="tabular-nums">{i._count._all}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Roles affected by month (last 12 months)</p>
            <WarnMonthlyBarChart bars={monthlyBuckets} />
          </div>
        </div>
      </AdminCollapsibleSection>

      <AdminCollapsibleSection title="State stats" summary={`${counts.length} states on file`}>
        <section className="grid gap-3 sm:grid-cols-4">
          {counts.map((c) => (
            <Link
              key={c.state}
              href={stateHref(c.state!)}
              className={`rounded-lg border p-3 hover:bg-muted ${state === c.state ? 'border-brand bg-brand/5' : 'border-border'}`}
            >
              <p className="text-xs text-muted-foreground">{c.state} notices on file</p>
              <p className="mt-0.5 text-lg font-semibold">{c._count._all.toLocaleString()}</p>
            </Link>
          ))}
          {runs[0] && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Last sync</p>
              <p className="mt-0.5 text-sm">
                {runs[0].state} · {formatDate(runs[0].startedAt)}
                {runs[0].error && <span className="block text-xs text-destructive">{runs[0].error}</span>}
              </p>
            </div>
          )}
        </section>
      </AdminCollapsibleSection>

      <Tabs defaultValue="notices">
        <TabsList>
          <TabsTrigger value="notices">Layoff notices</TabsTrigger>
          <TabsTrigger value="review">To review{ambiguous.length > 0 ? ` (${ambiguous.length})` : ''}</TabsTrigger>
        </TabsList>

        <TabsContent value="notices" className="space-y-3">
          <AdminFilterBar
            basePath="/support/admin/crm/warn"
            searchValue={q}
            searchPlaceholder="Search employer…"
            filters={[
              { key: 'status', label: 'Status', value: status, options: [
                { value: 'pending', label: 'Waiting for review' },
                { value: 'promoted', label: 'Already a lead' },
                { value: 'dismissed', label: 'Dismissed' },
                { value: 'all', label: 'Everything' },
              ] },
              { key: 'state', label: 'State', value: state, options: [{ value: '', label: 'Any state' }, ...counts.map((c) => ({ value: c.state!, label: c.state! }))] },
              { key: 'industry', label: 'Industry', value: industry, options: [{ value: '', label: 'Any industry' }, ...industryCounts.map((c) => ({ value: c.industry!, label: c.industry! }))] },
              { key: 'min', label: 'Size', value: Number.isFinite(minSize) ? String(minSize) : '', options: [
                { value: '', label: 'Any size' }, { value: '200', label: '200+' }, { value: '100', label: '100+' }, { value: '40', label: '40+' },
              ] },
            ]}
            dateRange={{ label: 'Effective', afterKey: 'effAfter', beforeKey: 'effBefore', afterValue: effAfter, beforeValue: effBefore }}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{total.toLocaleString()} notices</p>
            <PageSizePicker basePath="/support/admin/crm/warn" params={params} current={perPage} label="notices" />
          </div>

          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="font-medium">Nothing here.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {status === 'pending' ? 'Every notice has been reviewed.' : 'No notices match these filters.'}
              </p>
            </div>
          ) : (
            <WarnReviewBar count={rows.length}>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left">
                      <th className="w-8 px-2 py-1.5"><CrmSelectAll pageCount={rows.length} /></th>
                      <SortHeader label="Employer" sortKey="employer" current={sort} basePath="/support/admin/crm/warn" params={sortParams} className="px-3 py-1.5 font-medium" />
                      <SortHeader label="Roles" sortKey="employees" current={sort} basePath="/support/admin/crm/warn" params={sortParams} defaultDir="desc" className="px-2 py-1.5 font-medium" />
                      <SortHeader label="State" sortKey="state" current={sort} basePath="/support/admin/crm/warn" params={sortParams} className="px-2 py-1.5 font-medium" />
                      <th className="px-2 py-1.5 font-medium">Where</th>
                      <SortHeader label="Industry" sortKey="industry" current={sort} basePath="/support/admin/crm/warn" params={sortParams} className="px-2 py-1.5 font-medium" />
                      <SortHeader label="Filed" sortKey="noticeDate" current={sort} basePath="/support/admin/crm/warn" params={sortParams} defaultDir="desc" className="px-2 py-1.5 font-medium" />
                      <SortHeader label="Effective" sortKey="effectiveDate" current={sort} basePath="/support/admin/crm/warn" params={sortParams} defaultDir="desc" className="px-2 py-1.5 font-medium" />
                      <th className="px-2 py-1.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((n) => (
                      <tr key={n.id} className="border-b border-border last:border-0">
                        <td className="px-2 py-1.5">
                          {!n.promotedAt && !n.dismissedAt && (
                            <input type="checkbox" name="selected" value={n.id} aria-label={`Select ${n.employer}`} />
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-medium">
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-1.5">
                              {n.company ? (
                                <Link href={`/support/admin/companies/${n.company.id}`} className="text-primary underline underline-offset-4">
                                  {n.employer}
                                </Link>
                              ) : (
                                n.employer
                              )}
                              {n.source === 'MANUAL_ANNOUNCEMENT' && (
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Announced</span>
                              )}
                            </span>
                            {n.company && (
                              <CompanyPriorityAndChro
                                companyId={n.company.id}
                                priority={n.company.priority}
                                chroName={n.company.chroName}
                                chroEmail={n.company.chroEmail}
                                chroLinkedinUrl={n.company.chroLinkedinUrl}
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">{n.employees ?? <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-2 py-1.5 text-xs">{n.state ?? '—'}</td>
                        <td className="px-2 py-1.5 text-xs text-muted-foreground">{n.county ?? '—'}</td>
                        <td className="px-2 py-1.5 text-xs text-muted-foreground">
                          {n.industry ?? <span title="This state does not publish a sector">not published</span>}
                        </td>
                        <td className="px-2 py-1.5 text-xs whitespace-nowrap">{formatDate(n.noticeDate)}</td>
                        <td className="px-2 py-1.5 text-xs whitespace-nowrap">
                          {n.sourceUrl ? (
                            <a href={n.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">{formatDate(n.effectiveDate)}</a>
                          ) : (
                            formatDate(n.effectiveDate)
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-xs">
                          {n.promotedAt ? (
                            <span className="rounded-full bg-brand/15 px-2 py-0.5 text-brand">Lead</span>
                          ) : n.dismissedAt ? (
                            <span className="text-muted-foreground" title={n.dismissReason ?? undefined}>Dismissed</span>
                          ) : (
                            <span className="text-muted-foreground">Waiting</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </WarnReviewBar>
          )}

          {totalPages > 1 && (
            <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
              <span className="text-muted-foreground">Page {page} of {totalPages}</span>
              <span className="flex gap-2">
                {page > 1 && <Link href={`/support/admin/crm/warn?${new URLSearchParams({ ...params, page: String(page - 1) })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Previous</Link>}
                {page < totalPages && <Link href={`/support/admin/crm/warn?${new URLSearchParams({ ...params, page: String(page + 1) })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Next</Link>}
              </span>
            </nav>
          )}
        </TabsContent>

        <TabsContent value="review">
          {ambiguous.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="font-medium">Nothing to review.</p>
              <p className="mt-1 text-sm text-muted-foreground">Every employer matched cleanly to a company, or was new.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border">
              {ambiguous.map((n) => (
                <WarnCompanyReviewRow
                  key={n.id}
                  noticeId={n.id}
                  employer={n.employer}
                  candidates={(n.companyMatchCandidates as { id: string; name: string }[] | null) ?? []}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
