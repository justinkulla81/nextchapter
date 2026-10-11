import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { SortHeader, readSort } from '@/components/admin/SortHeader'
import { GEO_FILTERS, KIND_LABELS, REVENUE_BANDS, geoWhere, money, pct, num } from '@/lib/geo/filters'
import { STATE_NAMES } from '@/lib/workforce/places'
import { FitScoreBadge, type FitBreakdown } from '@/components/admin/FitScoreBadge'
import { addLeadToCrm, dismissLead } from './actions'

export const maxDuration = 30
const BASE = '/support/admin/crm/economic-development'
const PAGE_SIZE = 100
const SORTS: Record<string, (d: 'asc' | 'desc') => Prisma.GeoOrgLeadOrderByWithRelationInput> = {
  name: (d) => ({ name: d }),
  fit: (d) => ({ fitScore: { sort: d, nulls: 'last' } }),
  rev: (d) => ({ revenue: { sort: d, nulls: 'last' } }),
  pop: (d) => ({ geoArea: { population: { sort: d, nulls: 'last' } } }),
  wc: (d) => ({ geoArea: { wcUnemploymentEst: { sort: d, nulls: 'last' } } }),
  un: (d) => ({ geoArea: { unemploymentRate: { sort: d, nulls: 'last' } } }),
  inc: (d) => ({ geoArea: { medianHouseholdIncome: { sort: d, nulls: 'last' } } }),
  lay: (d) => ({ geoArea: { layoffs12mo: d } }),
}

export default async function EconomicDevelopmentLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const kind = sp.kind && KIND_LABELS[sp.kind] ? sp.kind : ''
  const state = sp.state ?? ''
  const rev = sp.rev ?? ''
  const status = sp.status ?? 'open'
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const sort = readSort(sp, Object.keys(SORTS), { sort: 'rev', dir: 'desc' })
  const geo = geoWhere(sp)

  const where: Prisma.GeoOrgLeadWhereInput = {
    AND: [
      ...(q ? [{ name: { contains: q, mode: 'insensitive' as const } }] : []),
      ...(kind ? [{ kind }] : []),
      ...(state ? [{ state }] : []),
      ...(REVENUE_BANDS.find((b) => b.value && b.value === rev)?.where ? [REVENUE_BANDS.find((b) => b.value === rev)!.where!] : []),
      ...(status === 'crm' ? [{ crmOrganizationId: { not: null } }] : status === 'dismissed' ? [{ dismissedAt: { not: null } }] : [{ dismissedAt: null, crmOrganizationId: null }]),
      ...(geo.length ? [{ geoArea: { is: { AND: geo } } }] : []),
    ],
  }
  const [total, rows] = await Promise.all([
    prisma.geoOrgLead.count({ where }),
    prisma.geoOrgLead.findMany({ where, include: { geoArea: true }, orderBy: [SORTS[sort.sort](sort.dir), { name: 'asc' }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]).catch(() => [0, []] as const)

  const params: Record<string, string> = { q, kind, state, rev, status, ...Object.fromEntries(GEO_FILTERS.map((f) => [f.key, sp[f.key] ?? ''])) }
  const qs = (over: Record<string, string | number>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...params, sort: sort.sort, dir: sort.dir, ...over })) if (v) p.set(k, String(v))
    return p.toString()
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const th = (label: string, key: string, defaultDir: 'asc' | 'desc' = 'desc') => (
    <SortHeader label={label} sortKey={key} current={sort} basePath={BASE} params={params} defaultDir={defaultDir} />
  )
  const empty = total === 0 && !q && !kind && !state && !rev && !geo.length && status === 'open'

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Economic development leads</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Economic development groups, chambers of commerce and workforce nonprofits (not WIOA boards), each tied to its county. Size is the group&apos;s annual revenue from its latest IRS filing. City and county government offices are not in this list.
          </p>
        </div>
        <Link href="/support/admin/crm/geographies" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">Geographies</Link>
      </header>

      <AdminFilterBar
        basePath={BASE}
        searchValue={q}
        searchPlaceholder="Search by organization name…"
        filters={[
          { key: 'kind', label: 'Type', value: kind, options: [{ value: '', label: 'Any type' }, ...Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))] },
          { key: 'status', label: 'Status', value: status, options: [{ value: 'open', label: 'Not yet in CRM' }, { value: 'crm', label: 'In CRM' }, { value: 'dismissed', label: 'Dismissed' }] },
          { key: 'state', label: 'State', value: state, options: [{ value: '', label: 'Any state' }, ...Object.entries(STATE_NAMES).map(([k, v]) => ({ value: k, label: v }))] },
          { key: 'rev', label: 'Budget', value: rev, options: REVENUE_BANDS.map((b) => ({ value: b.value, label: b.label })) },
          ...GEO_FILTERS.map((f) => ({ key: f.key, label: f.label, value: sp[f.key] ?? '', options: f.opts.map((o) => ({ value: o.value, label: o.label })) })),
        ]}
      />

      <p className="text-sm text-muted-foreground">{total.toLocaleString()} organizations</p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">{empty ? 'No leads loaded yet.' : 'No organizations match these filters.'}</p>
          <p className="mt-1 text-sm text-muted-foreground">{empty ? 'Apply prisma/manual/geo-tables.sql, then run scripts/geo/import-geo.ts --apply.' : 'Loosen a filter, or clear them all.'}</p>
          <Link href={BASE} className="mt-2 inline-block text-sm font-medium text-brand underline">Clear filters</Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                {th('Organization', 'name', 'asc')}
                {th('Fit', 'fit')}
                <th className="px-3 py-2 font-medium">Type</th>
                {th('Budget', 'rev')}
                <th className="px-3 py-2 font-medium">Where</th>
                {th('Population', 'pop')}
                {th('Unemployment', 'un')}
                {th('White-collar (est.)', 'wc')}
                {th('Median income', 'inc')}
                {th('Layoffs, 12 mo', 'lay')}
                <th className="px-3 py-2 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">
                    {l.crmOrganizationId ? <Link href={`/support/admin/crm/organizations/${l.crmOrganizationId}`} className="text-brand hover:underline">{l.name}</Link> : l.name}
                  </td>
                  <td className="px-3 py-2"><FitScoreBadge score={l.fitScore} breakdown={l.fitBreakdown as FitBreakdown} /></td>
                  <td className="px-3 py-2">{KIND_LABELS[l.kind] ?? l.kind}</td>
                  <td className="px-3 py-2 tabular-nums">{money(l.revenue)}</td>
                  <td className="px-3 py-2">
                    {l.geoArea ? <Link href={`/support/admin/crm/geographies/${l.geoArea.id}`} className="text-brand hover:underline">{l.geoArea.name}, {l.state}</Link> : `${l.city ?? ''}, ${l.state}`}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{num(l.geoArea?.population)}</td>
                  <td className="px-3 py-2 tabular-nums">{pct(l.geoArea?.unemploymentRate)}</td>
                  <td className="px-3 py-2 tabular-nums">{pct(l.geoArea?.wcUnemploymentEst)}</td>
                  <td className="px-3 py-2 tabular-nums">{money(l.geoArea?.medianHouseholdIncome)}</td>
                  <td className="px-3 py-2 tabular-nums">{l.geoArea?.layoffs12mo ? num(l.geoArea.layoffs12mo) : '–'}</td>
                  <td className="px-3 py-2">
                    <Link href={`/support/admin/crm/pitch?lead=${l.id}&type=${l.kind === 'CHAMBER' ? 'CHAMBER' : l.kind === 'WORKFORCE' ? 'WORKFORCE_NONPROFIT' : 'ECON_DEV'}&go=1`} className="mr-2 text-xs text-brand hover:underline">Build pitch</Link>
                    {!l.crmOrganizationId && !l.dismissedAt && (
                      <div className="flex gap-2">
                        <form action={addLeadToCrm}><input type="hidden" name="id" value={l.id} /><button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:opacity-90">Add to CRM</button></form>
                        <form action={dismissLead}><input type="hidden" name="id" value={l.id} /><button className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted">Dismiss</button></form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center gap-3 text-sm" aria-label="Pages">
          {page > 1 && <Link href={`${BASE}?${qs({ page: page - 1 })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Previous</Link>}
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          {page < totalPages && <Link href={`${BASE}?${qs({ page: page + 1 })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Next</Link>}
        </nav>
      )}
    </div>
  )
}
