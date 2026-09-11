import Link from 'next/link'
import type { Prisma, CrmLeadQuality, CrmEligibility, CrmFunderKind, CrmValueType } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { AdminMultiFilter } from '@/components/admin/AdminMultiFilter'
import { SortHeader, readSort } from '@/components/admin/SortHeader'
import { CrmStageSelect } from '@/components/admin/CrmStageSelect'
import { CrmPeekPanel, CrmPeekButton } from '@/components/admin/CrmPeekPanel'
import { CrmLeadBulkBar } from '@/components/admin/CrmLeadBulkBar'
import { CrmSelectAll } from '@/components/admin/CrmSelectAll'
import { SubmitButton } from '@/components/ui/submit-button'
import { updateOpportunity, setOpportunityDeadline, updateFunderFacts } from '../actions'
import { QUALITIES, QUALITY_LABELS, ELIGIBILITY_LABELS, qualityClass, formatDate } from '@/lib/crm/labels'
import { FUNDER_KINDS, FUNDER_KIND_LABELS, VALUE_TYPES, VALUE_TYPE_LABELS } from '@/lib/crm/funding'

export const maxDuration = 30
const PAGE_SIZES = [50, 100, 200, 1500] as const
const DEFAULT_PAGE_SIZE = 100

function money(min: number | null, max: number | null): string | null {
  const fmt = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : `$${Math.round(n / 1000)}K`)
  if (min && max && min !== max) return `${fmt(min)}–${fmt(max)}`
  if (max) return `≤${fmt(max)}`
  if (min) return fmt(min)
  return null
}
function toInput(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : ''
}
function csv(v: string | undefined): string[] {
  return (v ?? '').split(',').filter(Boolean)
}

export default async function CrmLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const pipe = sp.pipeline ?? ''
  const quality = sp.quality ?? ''
  const status = sp.status ?? 'open'
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const requested = parseInt(sp.per ?? '', 10)
  const perPage = (PAGE_SIZES as readonly number[]).includes(requested) ? requested : DEFAULT_PAGE_SIZE

  // Multi-select filters, comma-separated in the URL so a view stays shareable.
  const eligibility = csv(sp.eligibility) as CrmEligibility[]
  const funderKinds = csv(sp.kind) as CrmFunderKind[]
  const valueTypes = csv(sp.value) as CrmValueType[]
  const states = csv(sp.state)

  const SORTS = ['score', 'name', 'quality', 'amount', 'due']
  const sort = readSort(sp, SORTS, { sort: 'score', dir: 'desc' })
  const orderBy: Prisma.CrmOpportunityOrderByWithRelationInput[] =
    sort.sort === 'name' ? [{ title: sort.dir }]
    : sort.sort === 'quality' ? [{ leadQuality: sort.dir }, { priorityScore: 'desc' }]
    : sort.sort === 'amount' ? [{ amountUsdMax: { sort: sort.dir, nulls: 'last' } }]
    : sort.sort === 'due' ? [{ nextStepDueAt: { sort: sort.dir, nulls: 'last' } }]
    : [{ priorityScore: sort.dir }, { leadQuality: 'asc' }]

  const pipelines = await prisma.crmPipeline.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { stages: { orderBy: { sortOrder: 'asc' }, select: { id: true, label: true } } },
  })

  const where: Prisma.CrmOpportunityWhereInput = {
    ...(status === 'open' ? { outcome: 'OPEN' } : status === 'closed' ? { outcome: { not: 'OPEN' } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { nextStep: { contains: q, mode: 'insensitive' } },
            { org: { name: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
    ...(pipe ? { pipeline: { key: pipe } } : {}),
    ...(quality ? { leadQuality: quality as CrmLeadQuality } : {}),
    ...(eligibility.length > 0 ? { eligibility: { in: eligibility } } : {}),
    ...(funderKinds.length > 0 ? { org: { investorProfile: { funderKind: { in: funderKinds } } } } : {}),
    ...(valueTypes.length > 0 ? { org: { investorProfile: { valueTypes: { hasSome: valueTypes } } } } : {}),
    ...(states.length > 0 ? { org: { usState: { in: states } } } : {}),
  }

  const [total, rows, promised, stateRows] = await Promise.all([
    prisma.crmOpportunity.count({ where }),
    prisma.crmOpportunity.findMany({
      where, orderBy, skip: (page - 1) * perPage, take: perPage,
      select: {
        id: true, title: true, stageId: true, leadQuality: true, eligibility: true,
        priorityScore: true, priorityOverride: true, amountUsdMin: true, amountUsdMax: true,
        nextStep: true, nextStepDueAt: true, committedFollowUpAt: true, committedTo: true,
        pipeline: { select: { key: true, label: true } },
        org: {
          select: {
            id: true, name: true, usState: true,
            investorProfile: {
              select: {
                funderKind: true, valueTypes: true, preconditions: true, preconditionLeadTimeDays: true,
              },
            },
            deadlines: { orderBy: [{ dueAt: 'asc' }], take: 1, select: { id: true, label: true, dueAt: true } },
          },
        },
      },
    }),
    prisma.crmOpportunity.count({ where: { outcome: 'OPEN', committedFollowUpAt: { lt: new Date() } } }),
    prisma.crmOrganization.findMany({
      where: { usState: { not: null } }, distinct: ['usState'],
      select: { usState: true }, orderBy: { usState: 'asc' },
    }),
  ])

  const stagesByPipeline = new Map(pipelines.map((p) => [p.key, p.stages]))
  // Bulk stage moves address stages by KEY, because ids belong to one pipeline
  // and a selection routinely spans several. Only keys shared by every
  // pipeline are offered, so the option cannot silently apply to a subset.
  const sharedStageKeys = await prisma.crmStage.groupBy({
    by: ['key', 'label'], _count: { _all: true },
    having: { key: { _count: { gte: 2 } } },
    orderBy: { key: 'asc' },
  })
  const stageKeys = [...new Map(sharedStageKeys.map((s) => [s.key, { key: s.key, label: s.label }])).values()]
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const baseParams: Record<string, string> = {
    q, pipeline: pipe, quality, status,
    eligibility: eligibility.join(','), kind: funderKinds.join(','),
    value: valueTypes.join(','), state: states.join(','),
    per: String(perPage), sort: sort.sort, dir: sort.dir,
  }
  const qs = (over: Record<string, string | number>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...baseParams, ...over })) if (v) p.set(k, String(v))
    return p.toString()
  }
  const now = new Date()

  return (
    <div className="space-y-4">
      <CrmPeekPanel />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">All leads</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Every pipeline, scored and sortable. Priority is recomputed nightly; an override pins a row.
          </p>
        </div>
        <nav className="flex gap-2 text-sm">
          <Link href="/support/admin/crm/pipelines" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Pipelines</Link>
          <Link href="/support/admin/crm" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">People</Link>
        </nav>
      </header>

      {promised > 0 && (
        <p className="rounded-lg border border-orange/40 bg-orange/5 px-3 py-2 text-sm">
          <strong>{promised}</strong> {promised === 1 ? 'commitment is' : 'commitments are'} past the date you gave someone.
        </p>
      )}

      <AdminFilterBar
        basePath="/support/admin/crm/leads"
        searchValue={q}
        searchPlaceholder="Search organization, title or next step…"
        filters={[
          { key: 'pipeline', label: 'Pipeline', value: pipe, options: [{ value: '', label: 'All pipelines' }, ...pipelines.map((p) => ({ value: p.key, label: p.label }))] },
          { key: 'quality', label: 'Quality', value: quality, options: [{ value: '', label: 'Any quality' }, ...QUALITIES.map((x) => ({ value: x, label: QUALITY_LABELS[x] }))] },
          { key: 'status', label: 'Status', value: status, options: [{ value: 'open', label: 'Open only' }, { value: 'closed', label: 'Closed only' }, { value: 'all', label: 'Open and closed' }] },
        ]}
      />

      <div className="space-y-2 rounded-lg border border-border p-3">
        <AdminMultiFilter
          param="kind" label="Funder"
          options={FUNDER_KINDS.map((k) => ({ value: k, label: FUNDER_KIND_LABELS[k] }))}
        />
        <AdminMultiFilter
          param="value" label="What you get"
          options={VALUE_TYPES.map((v) => ({ value: v, label: VALUE_TYPE_LABELS[v] }))}
        />
        <AdminMultiFilter
          param="eligibility" label="Eligibility"
          options={(Object.keys(ELIGIBILITY_LABELS) as CrmEligibility[]).map((e) => ({ value: e, label: ELIGIBILITY_LABELS[e] }))}
        />
        {stateRows.length > 0 && (
          <AdminMultiFilter
            param="state" label="Where"
            options={stateRows.map((s) => ({ value: s.usState!, label: s.usState === 'NATIONAL' ? 'National' : s.usState! }))}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{total.toLocaleString()} leads</p>
        <div className="flex items-center gap-1 text-xs" role="group" aria-label="Leads per page">
          <span className="text-muted-foreground">Show</span>
          {PAGE_SIZES.map((n) => (
            <Link key={n} href={`/support/admin/crm/leads?${qs({ per: n, page: 1 })}`}
              aria-current={perPage === n ? 'page' : undefined}
              className={`rounded-md border px-2 py-1 ${perPage === n ? 'border-brand bg-brand/10 font-semibold text-brand' : 'border-border hover:bg-muted'}`}>
              {n}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">No leads match these filters.</p>
          <Link href="/support/admin/crm/leads" className="mt-2 inline-block text-sm font-medium text-brand underline">Clear filters</Link>
        </div>
      ) : (
        <CrmLeadBulkBar count={rows.length} stageKeys={stageKeys}>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="w-8 px-2 py-1.5"><CrmSelectAll pageCount={rows.length} /></th>
                <SortHeader label="Organization" sortKey="name" current={sort} basePath="/support/admin/crm/leads" params={baseParams} />
                <th className="px-2 py-1.5 font-medium">Pipeline</th>
                <th className="px-2 py-1.5 font-medium">Funder</th>
                <th className="px-2 py-1.5 font-medium">Gets you</th>
                <SortHeader label="Amount" sortKey="amount" current={sort} basePath="/support/admin/crm/leads" params={baseParams} defaultDir="desc" className="px-2 py-1.5 font-medium" />
                <th className="px-2 py-1.5 font-medium">Where</th>
                <SortHeader label="Deadline" sortKey="due" current={sort} basePath="/support/admin/crm/leads" params={baseParams} className="px-2 py-1.5 font-medium" />
                <SortHeader label="Grade" sortKey="quality" current={sort} basePath="/support/admin/crm/leads" params={baseParams} className="px-2 py-1.5 font-medium" />
                <th className="px-2 py-1.5 font-medium">Stage</th>
                <SortHeader label="Score" sortKey="score" current={sort} basePath="/support/admin/crm/leads" params={baseParams} defaultDir="desc" className="px-2 py-1.5 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const amount = money(o.amountUsdMin, o.amountUsdMax)
                const score = o.priorityOverride ?? o.priorityScore
                const prof = o.org?.investorProfile
                const deadline = o.org?.deadlines[0]
                const passed = deadline?.dueAt && deadline.dueAt < now
                const overdue = o.committedFollowUpAt && o.committedFollowUpAt < now
                return (
                  <tr key={o.id} className={`border-b border-border last:border-0 align-top ${overdue ? 'bg-orange/5' : ''}`}>
                    <td className="px-2 py-1.5">
                      <input type="checkbox" name="selected" value={o.id} aria-label={`Select ${o.org?.name ?? o.title}`} />
                    </td>
                    <td className="px-3 py-1.5">
                      {o.org ? (
                        <CrmPeekButton id={o.org.id} kind="org">{o.org.name}</CrmPeekButton>
                      ) : <span className="font-medium">{o.title}</span>}
                      {overdue && (
                        <span className="block text-xs text-orange">Promised {formatDate(o.committedFollowUpAt)}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">{o.pipeline.label}</td>
                    <td className="px-2 py-1.5 text-xs">
                      {prof?.funderKind ? FUNDER_KIND_LABELS[prof.funderKind] : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-xs">
                      {prof && prof.valueTypes.length > 0
                        ? prof.valueTypes.map((v) => VALUE_TYPE_LABELS[v]).join(', ')
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-xs whitespace-nowrap">{amount ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-2 py-1.5 text-xs">
                      {o.org?.usState === 'NATIONAL' ? 'National' : (o.org?.usState ?? <span className="text-muted-foreground">—</span>)}
                    </td>
                    <td className="px-2 py-1.5 text-xs whitespace-nowrap">
                      {deadline?.dueAt
                        ? <span className={passed ? 'text-destructive' : ''}>{formatDate(deadline.dueAt)}{passed ? ' · passed' : ''}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`rounded px-1 py-0.5 text-xs font-semibold ${qualityClass(o.leadQuality)}`}>
                        {o.leadQuality === 'UNGRADED' ? '—' : o.leadQuality}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="w-36">
                        <CrmStageSelect
                          opportunityId={o.id} stageId={o.stageId}
                          stages={stagesByPipeline.get(o.pipeline.key) ?? []}
                          label={`Stage for ${o.org?.name ?? o.title}`}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                        {Math.round(score)}{o.priorityOverride !== null && <span className="text-brand">*</span>}
                      </span>
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Edit</summary>
                        <div className="mt-2 space-y-3 text-left">
                          <form action={updateOpportunity.bind(null, o.id)} className="grid gap-2 sm:grid-cols-2">
                            <label className="sm:col-span-2 text-xs">
                              <span className="mb-1 block font-medium">Next step</span>
                              <textarea name="nextStep" rows={2} defaultValue={o.nextStep ?? ''} className="w-full rounded-md border border-input bg-transparent p-2 text-sm" />
                            </label>
                            <label className="text-xs"><span className="mb-1 block font-medium">Next step due</span>
                              <input type="date" name="nextStepDueAt" defaultValue={toInput(o.nextStepDueAt)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" /></label>
                            <label className="text-xs"><span className="mb-1 block font-medium">Date you promised them</span>
                              <input type="date" name="committedFollowUpAt" defaultValue={toInput(o.committedFollowUpAt)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" /></label>
                            <label className="sm:col-span-2 text-xs"><span className="mb-1 block font-medium">What you actually said</span>
                              <input name="committedTo" defaultValue={o.committedTo ?? ''} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" /></label>
                            <label className="text-xs"><span className="mb-1 block font-medium">Quality</span>
                              <select name="leadQuality" defaultValue={o.leadQuality} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm">
                                {QUALITIES.map((x) => <option key={x} value={x}>{QUALITY_LABELS[x]}</option>)}
                              </select></label>
                            <label className="text-xs"><span className="mb-1 block font-medium">Pin priority</span>
                              <input type="number" name="priorityOverride" min={0} max={100} defaultValue={o.priorityOverride ?? ''} placeholder="blank = computed" className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" /></label>
                            <div className="sm:col-span-2"><SubmitButton size="sm" pendingLabel="Saving…">Save lead</SubmitButton></div>
                          </form>

                          <form action={setOpportunityDeadline.bind(null, o.id)} className="flex flex-wrap items-end gap-2 border-t border-border pt-2">
                            <label className="text-xs">
                              <span className="mb-1 block font-medium">Programme deadline</span>
                              <input type="date" name="deadlineDate" defaultValue={toInput(deadline?.dueAt)} className="h-8 rounded-md border border-input bg-transparent px-2 text-sm" />
                            </label>
                            <label className="text-xs">
                              <span className="mb-1 block font-medium">Called</span>
                              <input name="deadlineLabel" defaultValue={deadline?.label ?? 'Deadline'} className="h-8 w-32 rounded-md border border-input bg-transparent px-2 text-sm" />
                            </label>
                            <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">Save date</SubmitButton>
                            <span className="text-xs text-muted-foreground">A past date is fine — it lands in the passed list where the refresh check lives.</span>
                          </form>

                          {o.org && (
                            <form action={updateFunderFacts.bind(null, o.org.id)} className="space-y-2 border-t border-border pt-2">
                              <div className="flex flex-wrap gap-2">
                                <label className="text-xs"><span className="mb-1 block font-medium">Funder kind</span>
                                  <select name="funderKind" defaultValue={prof?.funderKind ?? ''} className="h-8 rounded-md border border-input bg-transparent px-2 text-sm">
                                    <option value="">Not set</option>
                                    {FUNDER_KINDS.map((k) => <option key={k} value={k}>{FUNDER_KIND_LABELS[k]}</option>)}
                                  </select></label>
                                <label className="text-xs"><span className="mb-1 block font-medium">Precondition lead time (days)</span>
                                  <input type="number" name="preconditionLeadTimeDays" min={0} defaultValue={prof?.preconditionLeadTimeDays ?? ''} placeholder="0 = nothing in the way" className="h-8 w-44 rounded-md border border-input bg-transparent px-2 text-sm" /></label>
                              </div>
                              <fieldset>
                                <legend className="mb-1 text-xs font-medium">What you get</legend>
                                <div className="flex flex-wrap gap-x-3 gap-y-1">
                                  {VALUE_TYPES.map((v) => (
                                    <label key={v} className="flex items-center gap-1 text-xs">
                                      <input type="checkbox" name="valueTypes" value={v} defaultChecked={prof?.valueTypes.includes(v)} />
                                      {VALUE_TYPE_LABELS[v]}
                                    </label>
                                  ))}
                                </div>
                              </fieldset>
                              <label className="block text-xs"><span className="mb-1 block font-medium">Preconditions</span>
                                <input name="preconditions" defaultValue={prof?.preconditions ?? ''} placeholder="Requires a NJ nexus" className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" /></label>
                              <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">Save funder facts</SubmitButton>
                            </form>
                          )}
                        </div>
                      </details>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </CrmLeadBulkBar>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <span className="flex gap-2">
            {page > 1 && <Link href={`/support/admin/crm/leads?${qs({ page: page - 1 })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Previous</Link>}
            {page < totalPages && <Link href={`/support/admin/crm/leads?${qs({ page: page + 1 })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Next</Link>}
          </span>
        </nav>
      )}
    </div>
  )
}
