import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { SortHeader, readSort } from '@/components/admin/SortHeader'
import { GEO_FILTERS, geoWhere, localFirst, money, pct, num } from '@/lib/geo/filters'
import { STATE_NAMES } from '@/lib/workforce/places'

export const maxDuration = 30
const BASE = '/support/admin/crm/geographies'
const PAGE_SIZE = 100
const SORTS: Record<string, (d: 'asc' | 'desc') => Prisma.GeoAreaOrderByWithRelationInput> = {
  name: (d) => ({ name: d }),
  pop: (d) => ({ population: { sort: d, nulls: 'last' } }),
  un: (d) => ({ unemploymentRate: { sort: d, nulls: 'last' } }),
  wc: (d) => ({ wcUnemploymentEst: { sort: d, nulls: 'last' } }),
  wcs: (d) => ({ whiteCollarShare: { sort: d, nulls: 'last' } }),
  inc: (d) => ({ medianHouseholdIncome: { sort: d, nulls: 'last' } }),
  lay: (d) => ({ layoffs12mo: d }),
  he: (d) => ({ higherEdCount: d }),
  dc: (d) => ({ dataCenterCount: d }),
}

export default async function GeographiesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const level = sp.level === 'STATE' ? 'STATE' : sp.level === 'COUNTY' ? 'COUNTY' : ''
  const state = sp.state ?? ''
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const sort = readSort(sp, Object.keys(SORTS), { sort: 'lay', dir: 'desc' })

  const where: Prisma.GeoAreaWhereInput = {
    AND: [
      ...(q ? [{ name: { contains: q, mode: 'insensitive' as const } }] : []),
      ...(level ? [{ level }] : []),
      ...(state ? [{ state }] : []),
      ...geoWhere(sp),
    ],
  }
  const [total, rows] = await Promise.all([
    prisma.geoArea.count({ where }),
    prisma.geoArea.findMany({ where, orderBy: [SORTS[sort.sort](sort.dir), { name: 'asc' }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]).catch(() => [0, []] as const)

  const params: Record<string, string> = { q, level, state, ...Object.fromEntries(GEO_FILTERS.map((f) => [f.key, sp[f.key] ?? ''])) }
  const qs = (over: Record<string, string | number>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...params, sort: sort.sort, dir: sort.dir, ...over })) if (v) p.set(k, String(v))
    return p.toString()
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const th = (label: string, key: string, defaultDir: 'asc' | 'desc' = 'desc') => (
    <SortHeader label={label} sortKey={key} current={sort} basePath={BASE} params={params} defaultDir={defaultDir} />
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Geographies</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every state and county, with the local numbers a pitch needs. White-collar and blue-collar unemployment are estimates: no agency publishes them by county, so we split the county rate by its white-collar share.
          </p>
        </div>
        <Link href="/support/admin/crm/economic-development" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
          Economic development leads
        </Link>
      </header>

      <AdminFilterBar
        basePath={BASE}
        searchValue={q}
        searchPlaceholder="Search a county or state…"
        filters={[
          { key: 'level', label: 'Level', value: level, options: [{ value: '', label: 'States and counties' }, { value: 'STATE', label: 'States' }, { value: 'COUNTY', label: 'Counties' }] },
          { key: 'state', label: 'State', value: state, options: [{ value: '', label: 'Any state' }, ...Object.entries(STATE_NAMES).map(([k, v]) => ({ value: k, label: v }))] },
          ...GEO_FILTERS.map((f) => ({ key: f.key, label: f.label, value: sp[f.key] ?? '', options: f.opts.map((o) => ({ value: o.value, label: o.label })) })),
        ]}
      />

      <p className="text-sm text-muted-foreground">{total.toLocaleString()} areas</p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">{total === 0 && !q && !level && !state ? 'No geography data loaded yet.' : 'No areas match these filters.'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 0 && !q && !level && !state ? 'Apply prisma/manual/geo-tables.sql, then run scripts/geo/import-geo.ts --apply.' : 'Loosen a filter, or clear them all.'}
          </p>
          <Link href={BASE} className="mt-2 inline-block text-sm font-medium text-brand underline">Clear filters</Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                {th('Area', 'name', 'asc')}
                {th('Population', 'pop')}
                {th('Unemployment', 'un')}
                {th('White-collar (est.)', 'wc')}
                <th className="px-3 py-2 font-medium">Blue-collar (est.)</th>
                {th('White-collar share', 'wcs')}
                {th('Median income', 'inc')}
                {th('Layoffs, 12 mo', 'lay')}
                {th('Colleges', 'he')}
                {th('Data centers', 'dc')}
                <th className="px-3 py-2 font-medium">WIOA board</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const boards = localFirst((a.wioaBoards as { name: string; statewide?: boolean }[] | null) ?? [])
                const delta = a.unemploymentRate != null && a.unemploymentRatePrior != null ? a.unemploymentRate - a.unemploymentRatePrior : null
                return (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link href={`${BASE}/${a.id}`} className="font-medium text-brand underline-offset-2 hover:underline">
                        {a.level === 'STATE' ? a.name : `${a.name}, ${a.state}`}
                      </Link>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{num(a.population)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {pct(a.unemploymentRate)}
                      {delta != null && Math.abs(delta) >= 0.15 && <span className="ml-1 text-xs text-muted-foreground">{delta > 0 ? '▲' : '▼'}{Math.abs(delta).toFixed(1)}</span>}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{pct(a.wcUnemploymentEst)}</td>
                    <td className="px-3 py-2 tabular-nums">{pct(a.bcUnemploymentEst)}</td>
                    <td className="px-3 py-2 tabular-nums">{a.whiteCollarShare == null ? '–' : pct(a.whiteCollarShare * 100, 0)}</td>
                    <td className="px-3 py-2 tabular-nums">{money(a.medianHouseholdIncome)}</td>
                    <td className="px-3 py-2 tabular-nums">{a.layoffs12mo ? num(a.layoffs12mo) : '–'}</td>
                    <td className="px-3 py-2 tabular-nums">{a.higherEdCount || '–'}</td>
                    <td className="px-3 py-2 tabular-nums">{a.dataCenterCount || '–'}</td>
                    <td className="px-3 py-2">{boards[0]?.name ?? '–'}{boards.length > 1 ? ` +${boards.length - 1}` : ''}</td>
                  </tr>
                )
              })}
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
