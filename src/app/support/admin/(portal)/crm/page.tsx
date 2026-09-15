import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { CrmQuickAdd } from '@/components/admin/CrmQuickAdd'
import { CrmBulkBar } from '@/components/admin/CrmBulkBar'
import { CrmInlineSelect } from '@/components/admin/CrmInlineSelect'
import { CrmInlineOrgEdit } from '@/components/admin/CrmInlineOrgEdit'
import { CrmInlineRoles } from '@/components/admin/CrmInlineRoles'
import { CrmPeekPanel, CrmPeekButton } from '@/components/admin/CrmPeekPanel'
import { SortHeader, readSort } from '@/components/admin/SortHeader'
import { CrmContactCell } from '@/components/admin/CrmContactCell'
import { CrmSelectAll } from '@/components/admin/CrmSelectAll'
import {
  PERSON_ROLES, PERSON_ROLE_LABELS, QUALITIES, QUALITY_LABELS,
  WARMTHS, WARMTH_LABELS, PRIORITY_TIERS, PRIORITY_TIER_LABELS,
  qualityClass, priorityTierClass, sinceLabel,
} from '@/lib/crm/labels'
import type { CrmPersonRole, CrmLeadQuality, CrmWarmth, CrmGoal, CrmPriorityTier } from '@prisma/client'
import { GOALS, GOAL_LABELS } from '@/lib/crm/goals'

export const maxDuration = 30

// 100 by default: with 3,688 people, 50 meant paging constantly, and 200 makes
// the first paint noticeably slower. Overridable per view.
// 1500 is deliberately offered and deliberately last: it exists for a bulk
// pass over a filtered set, and it renders 1500 rows of inline controls, which
// is noticeably slow. Naming it "everything" would hide that.
const PAGE_SIZES = [50, 100, 200, 1500] as const
const DEFAULT_PAGE_SIZE = 100

export default async function CrmPeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const role = sp.role ?? ''
  const quality = sp.quality ?? ''
  const warmth = sp.warmth ?? ''
  const touched = sp.touched ?? ''
  const goal = sp.goal ?? ''
  const priority = sp.priority ?? ''
  const minScore = parseInt(sp.minScore ?? '', 10)
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  // Organization is not sortable: it lives on a to-many affiliation, which
  // Prisma cannot order by. Offering a column that silently did nothing would
  // be worse than leaving it plain.
  const SORTS = ['name', 'quality', 'warmth', 'touched', 'score']
  const sort = readSort(sp, SORTS, { sort: 'score', dir: 'desc' })
  // P0/P1/P2 rows lead every ordering, in that order; unset sorts last. A
  // tier that merely added points would sometimes still sit below the fold,
  // which is the one thing it must not do.
  const PINNED = { priority: { sort: 'asc', nulls: 'last' } } as const
  const orderBy =
    sort.sort === 'name' ? [PINNED, { fullName: sort.dir }]
    : sort.sort === 'quality' ? [PINNED, { leadQuality: sort.dir }, { fullName: 'asc' as const }]
    : sort.sort === 'warmth' ? [PINNED, { warmth: sort.dir }, { fullName: 'asc' as const }]
    : sort.sort === 'touched' ? [PINNED, { lastTouchedAt: { sort: sort.dir, nulls: 'last' as const } }]
    : [PINNED, { priorityScore: sort.dir }, { fullName: 'asc' as const }]

  const requested = parseInt(sp.per ?? '', 10)
  const perPage = (PAGE_SIZES as readonly number[]).includes(requested) ? requested : DEFAULT_PAGE_SIZE

  const where: Prisma.CrmPersonWhereInput = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
            { affiliations: { some: { org: { name: { contains: q, mode: 'insensitive' } } } } },
            { affiliations: { some: { title: { contains: q, mode: 'insensitive' } } } },
          ],
        }
      : {}),
    ...(role ? { roles: { has: role as CrmPersonRole } } : {}),
    ...(quality ? { leadQuality: quality as CrmLeadQuality } : {}),
    ...(warmth ? { warmth: warmth as CrmWarmth } : {}),
    ...(touched === 'never' ? { lastTouchedAt: null } : {}),
    ...(touched === 'ever' ? { lastTouchedAt: { not: null } } : {}),
    ...(goal ? { goals: { has: goal as CrmGoal } } : {}),
    ...(Number.isFinite(minScore) ? { priorityScore: { gte: minScore } } : {}),
    ...(priority ? { priority: priority as CrmPriorityTier } : {}),
  }

  const [total, rows, needsCompletion, orgNames] = await Promise.all([
    prisma.crmPerson.count({ where }),
    prisma.crmPerson.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, fullName: true, roles: true, goals: true, leadQuality: true, warmth: true, priority: true,
        lastTouchedAt: true, touchCount: true, priorityScore: true, linkedinUrl: true,
        affiliations: {
          where: { isPrimary: true }, take: 1,
          select: { title: true, org: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.crmPerson.count({ where: { needsCompletion: true, deletedAt: null } }),
    prisma.crmOrganization.findMany({ select: { name: true }, orderBy: { name: 'asc' }, take: 5000 }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const baseParams = {
    q, role, quality, warmth, touched, goal, priority,
    minScore: Number.isFinite(minScore) ? String(minScore) : '',
    per: String(perPage), sort: sort.sort, dir: sort.dir,
  }
  const qs = (over: Record<string, string | number>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...baseParams, ...over })) if (v) p.set(k, String(v))
    return p.toString()
  }

  return (
    <div className="space-y-6">
      <CrmPeekPanel />
      <datalist id="crm-org-names">
        {orgNames.map((o) => <option key={o.name} value={o.name} />)}
      </datalist>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">NextChapter Ecosystem</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone around NextChapter — investors, partners, employers, coaches, recruiters, policy people
            and job seekers — in one place, whatever combination of those they are.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link href="/support/admin/crm/queue" className="rounded-md border border-border px-3 py-1.5 font-medium hover:bg-muted">
            Queue
          </Link>
          <Link href="/support/admin/crm/leads" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            All leads
          </Link>
          <Link href="/support/admin/crm/pipelines" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Pipelines
          </Link>
          <Link href="/support/admin/crm/organizations" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Organizations
          </Link>
          <Link href="/support/admin/crm/research" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Research
          </Link>
          <Link href="/support/admin/crm/sync" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Activity sync
          </Link>
          <Link href="/support/admin/crm/segments" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Segments
          </Link>
          <Link href="/support/admin/crm/capture-tokens" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Capture tokens
          </Link>
          <Link href="/support/admin/crm/needs-completion" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Needs completion{needsCompletion > 0 && <span className="ml-1.5 rounded-full bg-orange/20 px-1.5 text-xs font-semibold text-orange">{needsCompletion}</span>}
          </Link>
          <Link href={`/support/admin/crm/export?${qs({})}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted" prefetch={false}>
            Download CSV
          </Link>
          <Link href="/support/admin/crm/import" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Upload CSV
          </Link>
        </nav>
      </header>

      <CrmQuickAdd />

      <AdminFilterBar
        basePath="/support/admin/crm"
        searchValue={q}
        searchPlaceholder="Search name, company, title, email or notes…"
        filters={[
          { key: 'role', label: 'Contact type', value: role, options: [{ value: '', label: 'Any contact type' }, ...PERSON_ROLES.map((r) => ({ value: r, label: PERSON_ROLE_LABELS[r] }))] },
          { key: 'quality', label: 'Quality', value: quality, options: [{ value: '', label: 'Any quality' }, ...QUALITIES.map((x) => ({ value: x, label: QUALITY_LABELS[x] }))] },
          { key: 'warmth', label: 'Warmth', value: warmth, options: [{ value: '', label: 'Any warmth' }, ...WARMTHS.map((x) => ({ value: x, label: WARMTH_LABELS[x] }))] },
          { key: 'touched', label: 'Contact', value: touched, options: [{ value: '', label: 'Contacted or not' }, { value: 'never', label: 'Never contacted' }, { value: 'ever', label: 'Contacted at least once' }] },
          { key: 'goal', label: 'Goal', value: goal, options: [{ value: '', label: 'Any goal' }, ...GOALS.map((g) => ({ value: g, label: GOAL_LABELS[g] }))] },
          // Thresholds match the real distribution: people top out around 67
          // and cluster near 30, so 70+ would match nobody and 30+ everybody.
          { key: 'priority', label: 'Priority', value: priority, options: [{ value: '', label: 'Any priority' }, ...PRIORITY_TIERS.map((t) => ({ value: t, label: PRIORITY_TIER_LABELS[t] }))] },
          { key: 'minScore', label: 'Priority', value: Number.isFinite(minScore) ? String(minScore) : '', options: [{ value: '', label: 'Any priority' }, { value: '45', label: 'Top — 45+' }, { value: '40', label: 'High — 40+' }, { value: '35', label: 'Above average — 35+' }] },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} {total === 1 ? 'person' : 'people'}
          {q || role || quality || warmth || touched ? ' matching these filters' : ''}
        </p>
        {/* Three discrete options -> adjacent buttons, per design-principles.md. */}
        <div className="flex items-center gap-1 text-xs" role="group" aria-label="People per page">
          <span className="text-muted-foreground">Show</span>
          {PAGE_SIZES.map((n) => (
            <Link
              key={n}
              href={`/support/admin/crm?${qs({ per: n, page: 1 })}`}
              aria-current={perPage === n ? 'page' : undefined}
              className={`rounded-md border px-2 py-1 ${perPage === n ? 'border-brand bg-brand/10 font-semibold text-brand' : 'border-border hover:bg-muted'}`}
            >
              {n}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">No one matches these filters.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Clear the search, or add someone with the box above.
          </p>
          <Link href="/support/admin/crm" className="mt-3 inline-block text-sm font-medium text-brand underline">
            Clear filters
          </Link>
        </div>
      ) : (
        <CrmBulkBar count={rows.length}>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="w-8 px-3 py-2">
                    <CrmSelectAll pageCount={rows.length} />
                  </th>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <SortHeader label="Name" sortKey="name" current={sort} basePath="/support/admin/crm" params={baseParams} />
                  <th className="px-3 py-2 font-medium">Organization</th>
                  <th className="px-3 py-2 font-medium">Contact type</th>
                  <th className="px-3 py-2 font-medium">Goal</th>
                  <SortHeader label="Quality" sortKey="quality" current={sort} basePath="/support/admin/crm" params={baseParams} />
                  <SortHeader label="Warmth" sortKey="warmth" current={sort} basePath="/support/admin/crm" params={baseParams} />
                  <SortHeader label="Contacted" sortKey="touched" current={sort} basePath="/support/admin/crm" params={baseParams} defaultDir="desc" />
                  <SortHeader label="Priority" sortKey="score" current={sort} basePath="/support/admin/crm" params={baseParams} defaultDir="desc" className="px-3 py-2 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <input type="checkbox" name="selected" value={p.id} aria-label={`Select ${p.fullName}`} />
                    </td>
                    <td className="px-3 py-2">
                      <span className={`mr-1.5 inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${priorityTierClass(p.priority)}`}>
                        {p.priority ?? '—'}
                      </span>
                      <CrmInlineSelect
                        personId={p.id} field="priority" value={p.priority ?? ''}
                        label={`Priority for ${p.fullName}`}
                        options={[{ value: '', label: 'None' }, ...PRIORITY_TIERS.map((t) => ({ value: t, label: PRIORITY_TIER_LABELS[t] }))]}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <CrmPeekButton id={p.id} kind="person">{p.fullName}</CrmPeekButton>
                      {p.affiliations[0]?.title && (
                        <span className="block text-xs text-muted-foreground">{p.affiliations[0].title}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <CrmInlineOrgEdit personId={p.id} orgName={p.affiliations[0]?.org.name ?? null} />
                        {p.affiliations[0]?.org && (
                          <CrmPeekButton id={p.affiliations[0].org.id} kind="org" className="shrink-0 text-xs text-muted-foreground hover:underline focus-visible:ring-2 focus-visible:ring-brand">
                            view
                          </CrmPeekButton>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <CrmInlineRoles personId={p.id} roles={p.roles} name={p.fullName} />
                    </td>
                    <td className="px-3 py-2">
                      {p.goals.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {p.goals.map((g) => (
                            <span key={g} className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">{GOAL_LABELS[g]}</span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`mr-1.5 inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${qualityClass(p.leadQuality)}`}>
                        {p.leadQuality === 'UNGRADED' ? '—' : p.leadQuality}
                      </span>
                      <CrmInlineSelect
                        personId={p.id} field="leadQuality" value={p.leadQuality}
                        label={`Quality for ${p.fullName}`}
                        options={QUALITIES.map((x) => ({ value: x, label: QUALITY_LABELS[x] }))}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <CrmInlineSelect
                        personId={p.id} field="warmth" value={p.warmth}
                        label={`Warmth for ${p.fullName}`}
                        options={WARMTHS.map((x) => ({ value: x, label: WARMTH_LABELS[x] }))}
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <CrmContactCell
                        personId={p.id} name={p.fullName}
                        lastLabel={sinceLabel(p.lastTouchedAt)} touchCount={p.touchCount}
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{Math.round(p.priorityScore)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CrmBulkBar>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <span className="flex gap-2">
            {page > 1 && (
              <Link href={`/support/admin/crm?${qs({ page: page - 1 })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/support/admin/crm?${qs({ page: page + 1 })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
                Next
              </Link>
            )}
          </span>
        </nav>
      )}
    </div>
  )
}
