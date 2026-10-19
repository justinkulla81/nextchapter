import Link from 'next/link'
import type { Prisma, CrmOrgType, CrmGoal } from '@prisma/client'
import { GOALS, GOAL_LABELS } from '@/lib/crm/goals'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { ORG_TYPES, ORG_TYPE_LABELS } from '@/lib/crm/labels'
import { CrmPeekPanel, CrmPeekButton } from '@/components/admin/CrmPeekPanel'
import { CrmOrgBulkBar } from '@/components/admin/CrmOrgBulkBar'
import { CrmSelectAll } from '@/components/admin/CrmSelectAll'
import { SortHeader, readSort } from '@/components/admin/SortHeader'
import { CrmDealStatusSelect } from '@/components/admin/CrmDealStatusSelect'
import { CrmOrganizationsViewTracker } from '@/components/admin/WorkforceBoardsViewTracker'
import { hasLearningDevHead, missingLearningDevHead } from '@/lib/crm/learning-dev'
import { ORG_RELATIONSHIPS, ORG_RELATIONSHIP_LABELS, isOrgRelationshipFilter, relationshipWhere, type OrgRelationshipFilter } from '@/lib/crm/org-relationships'
import { countOpenByOrg } from '@/lib/funding-opportunities/store'
import { layoffsByOrg, orgIdsWithLayoffs } from '@/lib/crm/org-layoffs'
import { DEAL_STATUSES, DEAL_STATUS_LABELS, isDealStatus } from '@/lib/crm/deal-status'

export const maxDuration = 30
const PAGE_SIZES = [50, 100, 200, 1500] as const
const DEFAULT_PAGE_SIZE = 100

export default async function CrmOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const type = sp.type ?? ''
  const rel: OrgRelationshipFilter | '' = isOrgRelationshipFilter(sp.rel) ? sp.rel : ''
  const goal = sp.goal ?? ''
  const deal = sp.deal ?? ''
  const layoffs = sp.layoffs === 'any' ? 'any' : ''
  const ldHead = sp.ldhead === 'missing' || sp.ldhead === 'has' ? sp.ldhead : ''
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const requested = parseInt(sp.per ?? '', 10)
  const perPage = (PAGE_SIZES as readonly number[]).includes(requested) ? requested : DEFAULT_PAGE_SIZE
  const SORTS = ['name', 'score', 'people']
  const sort = readSort(sp, SORTS, { sort: 'score', dir: 'desc' })
  const orderBy =
    sort.sort === 'name' ? [{ name: sort.dir }]
    : sort.sort === 'people' ? [{ affiliations: { _count: sort.dir } }]
    : [{ priorityScore: sort.dir }, { name: 'asc' as const }]

  const layoffOrgIds = layoffs ? await orgIdsWithLayoffs() : null
  const where: Prisma.CrmOrganizationWhereInput = {
    ...(layoffOrgIds ? { id: { in: layoffOrgIds } } : {}),
    ...(rel ? { AND: [relationshipWhere(rel)] } : {}),
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    ...(type ? { orgTypes: { has: type as CrmOrgType } } : {}),
    ...(goal ? { goals: { has: goal as CrmGoal } } : {}),
    ...(ldHead === 'missing' ? missingLearningDevHead : ldHead === 'has' ? hasLearningDevHead : {}),
    ...(deal === 'any' ? { dealStatus: { not: null } } : deal && isDealStatus(deal) ? { dealStatus: deal } : {}),
  }

  // Counts for the relationship buttons ignore the other filters, so the
  // numbers say how big each group is, not how many survived a search.
  const relCounts = rel
    ? await Promise.all((['all', ...ORG_RELATIONSHIPS] as const).map((r) => prisma.crmOrganization.count({ where: relationshipWhere(r) })))
    : []
  const [total, rows] = await Promise.all([
    prisma.crmOrganization.count({ where }),
    prisma.crmOrganization.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, name: true, orgTypes: true, hiringClient: true, goals: true, hqRegion: true, dealStatus: true,
        investorProfile: { select: { checkSizeNote: true } },
        _count: { select: { affiliations: true, opportunities: true, researchItems: true } },
      },
    }),
  ])
  const [oppCounts, layoffCounts] = await Promise.all([countOpenByOrg(rows.map((o) => o.id)), layoffsByOrg(rows.map((o) => o.id))])
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const qs = (over: Record<string, string | number>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ q, type, rel, goal, deal, layoffs, ldhead: ldHead, per: String(perPage), sort: sort.sort, dir: sort.dir, ...over })) if (v) p.set(k, String(v))
    return p.toString()
  }

  return (
    <div className="space-y-6">
      <CrmPeekPanel />
      <CrmOrganizationsViewTracker q={q} type={type} rel={rel} goal={goal} deal={deal} ldHead={ldHead} layoffs={layoffs} results={total} />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Organizations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One record per organization, however many things it is to us.
          </p>
        </div>
        <Link href="/support/admin/crm" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
          People
        </Link>
      </header>

      {rel && (
        <div role="group" aria-label="Relationship to us" className="flex flex-wrap items-center gap-1">
          {(['all', ...ORG_RELATIONSHIPS] as const).map((r, i) => (
            <Link
              key={r}
              href={`/support/admin/crm/organizations?${qs({ rel: r, page: 1 })}`}
              aria-current={rel === r ? 'page' : undefined}
              className={`h-8 rounded-md border px-3 text-sm leading-8 ${rel === r ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}
            >
              {ORG_RELATIONSHIP_LABELS[r]} <span className="text-xs opacity-70">{relCounts[i]?.toLocaleString()}</span>
            </Link>
          ))}
          <Link href={`/support/admin/crm/organizations?${qs({ rel: '', page: 1 })}`} className="ml-2 text-xs text-muted-foreground underline hover:text-foreground">
            Show every kind of organization
          </Link>
        </div>
      )}

      <AdminFilterBar
        basePath="/support/admin/crm/organizations"
        searchValue={q}
        searchPlaceholder="Search organizations…"
        filters={[
          { key: 'type', label: 'Type', value: type, options: [{ value: '', label: 'Any type' }, ...ORG_TYPES.map((t) => ({ value: t, label: ORG_TYPE_LABELS[t] }))] },
          { key: 'goal', label: 'Goal', value: goal, options: [{ value: '', label: 'Any goal' }, ...GOALS.map((g) => ({ value: g, label: GOAL_LABELS[g] }))] },
          { key: 'ldhead', label: 'Head of L&D', value: ldHead, options: [{ value: 'missing', label: 'Missing a head of L&D' }, { value: 'has', label: 'Has a head of L&D' }] },
          { key: 'layoffs', label: 'Layoffs', value: layoffs, options: [{ value: '', label: 'Any layoff history' }, { value: 'any', label: 'Has layoffs' }] },
          { key: 'deal', label: 'Deal', value: deal, options: [{ value: '', label: 'Any deal status' }, { value: 'any', label: 'Has a deal' }, ...DEAL_STATUSES.map((d) => ({ value: d, label: DEAL_STATUS_LABELS[d] }))] },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} {rel ? (rel === 'all' ? 'companies' : `${ORG_RELATIONSHIP_LABELS[rel].toLowerCase()} companies`) : 'organizations'}
        </p>
        <div className="flex items-center gap-1 text-xs" role="group" aria-label="Organizations per page">
          <span className="text-muted-foreground">Show</span>
          {PAGE_SIZES.map((n) => (
            <Link key={n} href={`/support/admin/crm/organizations?${qs({ per: n, page: 1 })}`}
              aria-current={perPage === n ? 'page' : undefined}
              className={`rounded-md border px-2 py-1 ${perPage === n ? 'border-brand bg-brand/10 font-semibold text-brand' : 'border-border hover:bg-muted'}`}>
              {n}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">No organizations match these filters.</p>
          <Link href="/support/admin/crm/organizations" className="mt-2 inline-block text-sm font-medium text-brand underline">Clear filters</Link>
        </div>
      ) : (
        <CrmOrgBulkBar count={rows.length}>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="w-8 px-3 py-2"><CrmSelectAll pageCount={rows.length} /></th>
                <SortHeader label="Organization" sortKey="name" current={sort} basePath="/support/admin/crm/organizations" params={{ q, type, rel, goal, deal, layoffs, ldhead: ldHead, per: String(perPage) }} />
                <th className="px-3 py-2 font-medium">What it is to us</th>
                <th className="px-3 py-2 font-medium">Goal</th>
                <th className="px-3 py-2 font-medium">Deal</th>
                <SortHeader label="People" sortKey="people" current={sort} basePath="/support/admin/crm/organizations" params={{ q, type, rel, goal, deal, layoffs, ldhead: ldHead, per: String(perPage) }} defaultDir="desc" />
                <th className="px-3 py-2 font-medium" title="WARN filings and announced layoffs at this organization, with the jobs they name and the latest date">Layoffs</th>
                <th className="px-3 py-2 font-medium">Pipelines</th>
                <th className="px-3 py-2 font-medium" title="Open grants and forecasts this organization issues">Funding</th>
                <th className="px-3 py-2 font-medium" title="Open RFPs, RFIs and pre-solicitations this organization issues">RFPs</th>
                <th className="px-3 py-2 font-medium">Research</th>
                <th className="px-3 py-2 font-medium">Check size</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <input type="checkbox" name="selected" value={o.id} aria-label={`Select ${o.name}`} />
                  </td>
                  <td className="px-3 py-2">
                    <CrmPeekButton id={o.id} kind="org">{o.name}</CrmPeekButton>
                    {o.hqRegion && <span className="block text-xs text-muted-foreground">{o.hqRegion}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {o.hiringClient && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">Hiring client</span>}
                      {o.orgTypes.map((t) => (
                        <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">{ORG_TYPE_LABELS[t]}</span>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {o.goals.length ? o.goals.map((g) => GOAL_LABELS[g]).join(', ') : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <CrmDealStatusSelect orgId={o.id} value={o.dealStatus} surface="list" />
                  </td>
                  <td className="px-3 py-2">
                    {o._count.affiliations > 0 ? (
                      <Link href={`/support/admin/crm?q=${encodeURIComponent(o.name)}`} className="hover:underline">
                        {o._count.affiliations}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {(() => {
                      const l = layoffCounts.get(o.id)
                      if (!l || (l.notices === 0 && l.news === 0)) return <span className="text-muted-foreground">—</span>
                      return (
                        <Link href={`/support/admin/crm/warn?${new URLSearchParams({ q: o.name, status: 'all' })}`} className="block hover:underline">
                          {l.notices > 0 && <span className="font-medium">{l.notices} {l.notices === 1 ? 'notice' : 'notices'}</span>}
                          {l.employees > 0 && <span className="block text-muted-foreground">{l.employees.toLocaleString()} jobs{l.latest ? `, ${l.latest.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}</span>}
                          {l.news > 0 && <span className="block text-muted-foreground">{l.news} in the news</span>}
                        </Link>
                      )
                    })()}
                  </td>
                  <td className="px-3 py-2">{o._count.opportunities || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2">{oppCounts.get(o.id)?.funding || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2">{oppCounts.get(o.id)?.rfps || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2">{o._count.researchItems || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 text-xs">{o.investorProfile?.checkSizeNote ?? <span className="text-muted-foreground">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </CrmOrgBulkBar>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <span className="flex gap-2">
            {page > 1 && <Link href={`/support/admin/crm/organizations?${qs({ page: page - 1 })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Previous</Link>}
            {page < totalPages && <Link href={`/support/admin/crm/organizations?${qs({ page: page + 1 })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Next</Link>}
          </span>
        </nav>
      )}
    </div>
  )
}
