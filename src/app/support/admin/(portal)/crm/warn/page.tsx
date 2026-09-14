import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { CrmSelectAll } from '@/components/admin/CrmSelectAll'
import { PageSizePicker, readPageSize } from '@/components/admin/PageSizePicker'
import { WarnReviewBar, WarnSyncNowButton } from '@/components/admin/WarnReviewBar'
import { formatDate } from '@/lib/crm/labels'

export const maxDuration = 60

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
  const minSize = parseInt(sp.min ?? '', 10)
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const perPage = readPageSize(sp.per)

  const where: Prisma.WarnNoticeWhereInput = {
    ...(status === 'pending' ? { promotedAt: null, dismissedAt: null }
      : status === 'promoted' ? { promotedAt: { not: null } }
      : status === 'dismissed' ? { dismissedAt: { not: null } } : {}),
    ...(state ? { state } : {}),
    ...(Number.isFinite(minSize) ? { employees: { gte: minSize } } : {}),
    ...(q ? { employer: { contains: q, mode: 'insensitive' } } : {}),
  }

  const [total, rows, counts, runs] = await Promise.all([
    prisma.warnNotice.count({ where }),
    prisma.warnNotice.findMany({
      where,
      orderBy: [{ employees: { sort: 'desc', nulls: 'last' } }, { noticeDate: 'desc' }],
      skip: (page - 1) * perPage, take: perPage,
    }),
    prisma.warnNotice.groupBy({ by: ['state'], _count: { _all: true } }),
    prisma.warnSyncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 4 }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const params = { q, state, status, min: Number.isFinite(minSize) ? String(minSize) : '' }

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
            Synced every Monday. California carries an industry sector, so its knowledge-work filings become
            leads on their own; Texas does not publish one, so its notices wait here for you.
          </p>
        </div>
        <WarnSyncNowButton />
      </header>

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        Why these and not layoffs.fyi: that site embeds a private Airtable base whose data endpoint refuses
        access. WARN filings are public records, and they carry the <strong className="text-foreground">effective
        date</strong> — which is the number that decides when outreach lands, since reaching people before they
        leave is the whole point.
      </div>

      <section className="grid gap-3 sm:grid-cols-4">
        {counts.map((c) => (
          <div key={c.state} className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">{c.state} notices on file</p>
            <p className="mt-0.5 text-lg font-semibold">{c._count._all.toLocaleString()}</p>
          </div>
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
          { key: 'state', label: 'State', value: state, options: [{ value: '', label: 'Any state' }, ...counts.map((c) => ({ value: c.state, label: c.state }))] },
          { key: 'min', label: 'Size', value: Number.isFinite(minSize) ? String(minSize) : '', options: [
            { value: '', label: 'Any size' }, { value: '200', label: '200+' }, { value: '100', label: '100+' }, { value: '40', label: '40+' },
          ] },
        ]}
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
                  <th className="px-3 py-1.5 font-medium">Employer</th>
                  <th className="px-2 py-1.5 font-medium">Roles</th>
                  <th className="px-2 py-1.5 font-medium">State</th>
                  <th className="px-2 py-1.5 font-medium">Where</th>
                  <th className="px-2 py-1.5 font-medium">Industry</th>
                  <th className="px-2 py-1.5 font-medium">Filed</th>
                  <th className="px-2 py-1.5 font-medium">Effective</th>
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
                    <td className="px-3 py-1.5 font-medium">{n.employer}</td>
                    <td className="px-2 py-1.5 tabular-nums">{n.employees ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-2 py-1.5 text-xs">{n.state}</td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">{n.county ?? '—'}</td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">
                      {n.industry ?? <span title="This state does not publish a sector">not published</span>}
                    </td>
                    <td className="px-2 py-1.5 text-xs whitespace-nowrap">{formatDate(n.noticeDate)}</td>
                    <td className="px-2 py-1.5 text-xs whitespace-nowrap">{formatDate(n.effectiveDate)}</td>
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
            {page > 1 && <Link href={`/support/admin/crm/warn?${new URLSearchParams({ ...params, per: String(perPage), page: String(page - 1) })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Previous</Link>}
            {page < totalPages && <Link href={`/support/admin/crm/warn?${new URLSearchParams({ ...params, per: String(perPage), page: String(page + 1) })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Next</Link>}
          </span>
        </nav>
      )}
    </div>
  )
}
