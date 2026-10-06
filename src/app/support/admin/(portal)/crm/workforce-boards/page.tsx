import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { PageSizePicker, readPageSize } from '@/components/admin/PageSizePicker'
import { BoardContact } from '@/components/admin/WarnWorkforceBoard'
import { WorkforceBoardsViewTracker } from '@/components/admin/WorkforceBoardsViewTracker'
import { buildBoardReport, isCompanyWide, type ReportSort } from '@/lib/workforce/board-report'
import { jobCentersUrl } from '@/lib/workforce/directory'
import { formatDate } from '@/lib/crm/labels'

export const maxDuration = 60

const BASE = '/support/admin/crm/workforce-boards'
const SORTS: { key: ReportSort; label: string; defaultDir: 'asc' | 'desc' }[] = [
  { key: 'jobs', label: 'Total job loss', defaultDir: 'desc' },
  { key: 'recent', label: 'Most recent', defaultDir: 'desc' },
  { key: 'name', label: 'Name', defaultDir: 'asc' },
]
const WINDOWS = [
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: '12m', label: 'Last 12 months', days: 365 },
  { key: 'all', label: 'Everything on file', days: null },
] as const

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000)
}

function ButtonGroup({ label, items }: { label: string; items: { href: string; label: string; active: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs" role="group" aria-label={label}>
      <span className="mr-1 text-muted-foreground">{label}</span>
      {items.map((i) => (
        <Link
          key={i.label}
          href={i.href}
          aria-current={i.active ? 'true' : undefined}
          className={`rounded-md border px-2.5 py-1 ${i.active ? 'border-brand bg-brand/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}
        >
          {i.label}
        </Link>
      ))}
    </div>
  )
}

export default async function WorkforceBoardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const state = sp.state ?? ''
  const sort: ReportSort = SORTS.some((s) => s.key === sp.sort) ? (sp.sort as ReportSort) : 'jobs'
  const sortDef = SORTS.find((s) => s.key === sort)!
  const dir: 'asc' | 'desc' = sp.dir === 'asc' || sp.dir === 'desc' ? sp.dir : sortDef.defaultDir
  const windowKey = WINDOWS.some((w) => w.key === sp.window) ? sp.window! : '12m'
  const windowDays = WINDOWS.find((w) => w.key === windowKey)!.days
  const includeEmpty = sp.empty === '1'
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const perPage = readPageSize(sp.per)

  const [boards, notices, states] = await Promise.all([
    prisma.workforceBoard.findMany({
      where: { statewide: false, ...(state ? { state } : {}) },
      orderBy: { name: 'asc' },
    }),
    prisma.warnNotice.findMany({
      where: {
        workforceBoardId: { not: null },
        // Dismissed notices are duplicates of ones already counted.
        dismissedAt: null,
        ...(state ? { state } : {}),
        ...(windowDays ? { noticeDate: { gte: daysAgo(windowDays) } } : {}),
      },
      select: {
        id: true, workforceBoardId: true, employer: true, normalizedEmployer: true, employees: true,
        noticeDate: true, effectiveDate: true, companyId: true, sourceUrl: true, source: true,
      },
    }),
    prisma.workforceBoard.groupBy({ by: ['state'], where: { statewide: false }, orderBy: { state: 'asc' } }),
  ])

  const rows = buildBoardReport(boards, notices.map((n) => ({ ...n, companyWide: isCompanyWide(n) })), { q, sort, dir, includeEmpty })
  const totals = rows.reduce((t, r) => ({ jobs: t.jobs + r.jobs, companies: t.companies + r.companies.length }), { jobs: 0, companies: 0 })
  const anyReported = rows.some((r) => r.reportedJobs > 0)
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage))
  const pageRows = rows.slice((page - 1) * perPage, page * perPage)

  const params: Record<string, string> = {
    q, state, sort, dir, window: windowKey, per: String(perPage), ...(includeEmpty ? { empty: '1' } : {}),
  }
  const href = (over: Record<string, string>) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...params, page: '1', ...over })) if (v) qs.set(k, v)
    return `${BASE}?${qs}`
  }
  const windowLabel = WINDOWS.find((w) => w.key === windowKey)!.label.toLowerCase()

  return (
    <div className="space-y-4">
      <WorkforceBoardsViewTracker q={q} state={state} sort={sort} dir={dir} window={windowKey} results={rows.length} />
      <nav className="text-sm">
        <Link href="/support/admin/crm/warn" className="text-muted-foreground hover:underline">← Layoff notices</Link>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold">Workforce boards</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Every local workforce development board (WIOA) and the layoffs filed in its area: which companies,
          how many jobs, and when. The board runs Rapid Response for those layoffs, so it is the public partner
          to call. Contacts come from the Department of Labor&apos;s CareerOneStop directory, refreshed weekly.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Boards with layoffs, {windowLabel}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{rows.filter((r) => r.notices > 0).length.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Jobs lost (state WARN filings)</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{totals.jobs.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Companies</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{totals.companies.toLocaleString()}</p>
        </div>
      </section>

      <AdminFilterBar
        basePath={BASE}
        searchValue={q}
        searchPlaceholder="Search board, state, county, contact or company…"
        filters={[
          { key: 'state', label: 'State', value: state, options: [{ value: '', label: 'Any state' }, ...states.map((s) => ({ value: s.state, label: s.state }))] },
        ]}
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <ButtonGroup
          label="Sort by"
          items={SORTS.map((s) => {
            const active = s.key === sort
            const arrow = active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''
            return { label: `${s.label}${arrow}`, active, href: href({ sort: s.key, dir: active ? (dir === 'asc' ? 'desc' : 'asc') : s.defaultDir }) }
          })}
        />
        <ButtonGroup label="Filed" items={WINDOWS.map((w) => ({ label: w.label, active: w.key === windowKey, href: href({ window: w.key }) }))} />
        <ButtonGroup
          label="Boards"
          items={[
            { label: 'With layoffs', active: !includeEmpty, href: href({ empty: '' }) },
            { label: 'All boards', active: includeEmpty, href: href({ empty: '1' }) },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{rows.length.toLocaleString()} boards</p>
        <PageSizePicker basePath={BASE} params={params} current={perPage} label="boards" />
      </div>

      {pageRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">No boards match.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {q ? `Nothing matches “${q}” ${windowLabel === 'everything on file' ? '' : `filed in the ${windowLabel}`}. Try a wider date range or another spelling.` : 'No layoffs were filed in this range. Try a wider date range.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-3 py-1.5 font-medium">Board</th>
                <th className="px-3 py-1.5 font-medium">Contacts</th>
                <th className="px-2 py-1.5 text-right font-medium" title="Jobs in state WARN filings for this board's area">Jobs lost</th>
                {anyReported && (
                  <th className="px-2 py-1.5 text-right font-medium" title="Company-wide layoffs (layoffs.fyi, announcements) for companies headquartered here. Not all of these jobs are local, so they are not in Jobs lost.">
                    Reported company-wide
                  </th>
                )}
                <th className="px-2 py-1.5 text-right font-medium">Companies</th>
                <th className="px-2 py-1.5 font-medium">Latest filing</th>
                <th className="px-2 py-1.5 font-medium" title="The soonest effective date still ahead">Next effective</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => {
                const b = r.board
                const site = b.website ?? b.detailsUrl
                return (
                  <tr key={b.id} className="border-b border-border align-top last:border-0">
                    <td className="max-w-md px-3 py-2">
                      <p className="font-medium">
                        {site ? <a href={site} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">{b.name}</a> : b.name}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">{b.state}</span>
                      </p>
                      {b.serviceArea && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground" title={b.serviceArea}>{b.serviceArea}</p>}
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
                        <a href={jobCentersUrl(b.zip, b.state)} target="_blank" rel="noreferrer" className="text-primary hover:underline">Job centers (partners)</a>
                        {b.detailsUrl && <a href={b.detailsUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:underline">Directory listing</a>}
                        {b.address && <span className="text-muted-foreground">{b.address}</span>}
                      </p>
                      {r.companies.length > 0 && (
                        <details className="mt-2" open={r.matchedCompany}>
                          <summary className="cursor-pointer text-xs text-primary">
                            {r.companies.length === 1 ? '1 company' : `${r.companies.length} companies`}
                            {r.notices !== r.companies.length && ` · ${r.notices} notices`}
                          </summary>
                          <table className="mt-1.5 w-full text-xs">
                            <thead>
                              <tr className="text-left text-muted-foreground">
                                <th className="py-0.5 pr-2 font-normal">Company</th>
                                <th className="py-0.5 pr-2 text-right font-normal">Jobs</th>
                                <th className="py-0.5 pr-2 font-normal">Filed</th>
                                <th className="py-0.5 font-normal">Effective</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.companies.map((c) => {
                                const hit = q && c.employer.toLowerCase().includes(q.toLowerCase())
                                return (
                                  <tr key={c.key} className={hit ? 'bg-brand/10' : undefined}>
                                    <td className="py-0.5 pr-2">
                                      {c.companyId ? (
                                        <Link href={`/support/admin/companies/${c.companyId}`} className="hover:underline">{c.employer}</Link>
                                      ) : c.employer}
                                      {c.notices > 1 && <span className="text-muted-foreground"> · {c.notices} notices</span>}
                                      {c.companyWide && (
                                        <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground" title="A company-wide count reported for this headquarters, not a state filing for local jobs">
                                          company-wide
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-0.5 pr-2 text-right tabular-nums">
                                      {c.jobs ? c.jobs.toLocaleString() : '—'}{c.jobsUnknown && c.jobs ? '+' : ''}
                                    </td>
                                    <td className="whitespace-nowrap py-0.5 pr-2">
                                      {c.sourceUrl ? <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">{formatDate(c.latestFiled)}</a> : formatDate(c.latestFiled)}
                                    </td>
                                    <td className="whitespace-nowrap py-0.5">
                                      {formatDate(c.firstEffective)}
                                      {c.lastEffective && c.firstEffective && c.lastEffective.getTime() !== c.firstEffective.getTime() && ` – ${formatDate(c.lastEffective)}`}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </details>
                      )}
                    </td>
                    <td className="min-w-64 space-y-0.5 px-3 py-2 text-xs">
                      <BoardContact role={b.directorTitle ?? 'Director'} name={b.directorName} email={b.directorEmail} phone={b.directorPhone} />
                      <BoardContact role="Board chair" name={b.chairName} email={b.chairEmail} phone={b.chairPhone} />
                      {!b.directorName && !b.chairName && <span className="text-muted-foreground">Not listed</span>}
                    </td>
                    <td className="px-2 py-2 text-right font-medium tabular-nums">{r.jobs.toLocaleString()}</td>
                    {anyReported && (
                      <td className="px-2 py-2 text-right text-xs text-muted-foreground tabular-nums">{r.reportedJobs ? r.reportedJobs.toLocaleString() : '—'}</td>
                    )}
                    <td className="px-2 py-2 text-right tabular-nums">{r.companies.length}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs">{r.latestFiled ? formatDate(r.latestFiled) : '—'}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs">{r.nextEffective ? formatDate(r.nextEffective) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <span className="flex gap-2">
            {page > 1 && <Link href={href({ page: String(page - 1) })} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Previous</Link>}
            {page < totalPages && <Link href={href({ page: String(page + 1) })} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Next</Link>}
          </span>
        </nav>
      )}
    </div>
  )
}
