import Link from 'next/link'
import type { Prisma, CrmLeadQuality, CrmEligibility } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { CrmStageSelect } from '@/components/admin/CrmStageSelect'
import { SubmitButton } from '@/components/ui/submit-button'
import { updateOpportunity } from '../actions'
import { QUALITIES, QUALITY_LABELS, ELIGIBILITY_LABELS, qualityClass, formatDate } from '@/lib/crm/labels'

export const maxDuration = 30
const PAGE_SIZE = 40

function money(min: number | null, max: number | null): string | null {
  const fmt = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : `$${Math.round(n / 1000)}K`)
  if (min && max && min !== max) return `${fmt(min)}–${fmt(max)}`
  if (max) return `up to ${fmt(max)}`
  if (min) return fmt(min)
  return null
}
function toInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : ''
}

// One scored list across every pipeline — the view that replaces opening five
// spreadsheets to ask one question.
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
  const eligibility = sp.eligibility ?? ''
  const status = sp.status ?? 'open'
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)

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
    ...(eligibility ? { eligibility: eligibility as CrmEligibility } : {}),
  }

  const [total, rows, promised] = await Promise.all([
    prisma.crmOpportunity.count({ where }),
    prisma.crmOpportunity.findMany({
      where,
      orderBy: [{ priorityScore: 'desc' }, { leadQuality: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, title: true, stageId: true, leadQuality: true, eligibility: true,
        priorityScore: true, priorityOverride: true, amountUsdMin: true, amountUsdMax: true,
        nextStep: true, nextStepDueAt: true, committedFollowUpAt: true, committedTo: true,
        pipeline: { select: { key: true, label: true } },
        org: { select: { id: true, name: true } },
      },
    }),
    prisma.crmOpportunity.count({ where: { outcome: 'OPEN', committedFollowUpAt: { lt: new Date() } } }),
  ])

  const stagesByPipeline = new Map(pipelines.map((p) => [p.key, p.stages]))
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const qs = (over: Record<string, string | number>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ q, pipeline: pipe, quality, eligibility, status, ...over })) if (v) p.set(k, String(v))
    return p.toString()
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">All leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every pipeline, scored and sortable. Priority is recomputed nightly; an override pins a row.
          </p>
        </div>
        <nav className="flex gap-2 text-sm">
          <Link href="/support/admin/crm/pipelines" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Pipelines</Link>
          <Link href="/support/admin/crm" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">People</Link>
        </nav>
      </header>

      {promised > 0 && (
        <p className="rounded-lg border border-orange/40 bg-orange/5 p-3 text-sm">
          <strong>{promised}</strong> {promised === 1 ? 'commitment is' : 'commitments are'} past the date you
          gave someone. Those outrank everything else.
        </p>
      )}

      <AdminFilterBar
        basePath="/support/admin/crm/leads"
        searchValue={q}
        searchPlaceholder="Search organization, title or next step…"
        filters={[
          { key: 'pipeline', label: 'Pipeline', value: pipe, options: [{ value: '', label: 'All pipelines' }, ...pipelines.map((p) => ({ value: p.key, label: p.label }))] },
          { key: 'quality', label: 'Quality', value: quality, options: [{ value: '', label: 'Any quality' }, ...QUALITIES.map((x) => ({ value: x, label: QUALITY_LABELS[x] }))] },
          { key: 'eligibility', label: 'Eligibility', value: eligibility, options: [{ value: '', label: 'Any eligibility' }, ...(Object.keys(ELIGIBILITY_LABELS) as CrmEligibility[]).map((e) => ({ value: e, label: ELIGIBILITY_LABELS[e] }))] },
          { key: 'status', label: 'Status', value: status, options: [{ value: 'open', label: 'Open only' }, { value: 'closed', label: 'Closed only' }, { value: 'all', label: 'Open and closed' }] },
        ]}
      />

      <p className="text-sm text-muted-foreground">{total.toLocaleString()} leads</p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">No leads match these filters.</p>
          <Link href="/support/admin/crm/leads" className="mt-2 inline-block text-sm font-medium text-brand underline">Clear filters</Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((o) => {
            const amount = money(o.amountUsdMin, o.amountUsdMax)
            const score = o.priorityOverride ?? o.priorityScore
            const save = updateOpportunity.bind(null, o.id)
            const overdue = o.committedFollowUpAt && o.committedFollowUpAt < new Date()
            return (
              <li key={o.id} className={`rounded-lg border p-3 ${overdue ? 'border-orange/50 bg-orange/5' : 'border-border'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {o.org ? (
                        <Link href={`/support/admin/crm/organizations/${o.org.id}`} className="hover:underline">{o.org.name}</Link>
                      ) : o.title}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{o.pipeline.label}</span>
                      <span className={`rounded px-1 py-0.5 font-semibold ${qualityClass(o.leadQuality)}`}>
                        {o.leadQuality === 'UNGRADED' ? 'Ungraded' : o.leadQuality}
                      </span>
                      {amount && <span>{amount}</span>}
                      {o.eligibility === 'NONPROFIT_ONLY' && <span>Nonprofit only — kept, never surfaced</span>}
                      {o.nextStepDueAt && <span>Next step {formatDate(o.nextStepDueAt)}</span>}
                    </p>
                    {overdue && (
                      <p className="mt-1 text-xs font-medium text-orange">
                        Promised by {formatDate(o.committedFollowUpAt)}
                        {o.committedTo && <span className="font-normal"> — “{o.committedTo}”</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded bg-muted px-2 py-1 text-sm font-semibold tabular-nums">
                      {Math.round(score)}
                      {o.priorityOverride !== null && <span className="ml-0.5 text-brand" title="Pinned">*</span>}
                    </span>
                    <div className="w-40">
                      <CrmStageSelect
                        opportunityId={o.id} stageId={o.stageId}
                        stages={stagesByPipeline.get(o.pipeline.key) ?? []}
                        label={`Stage for ${o.org?.name ?? o.title}`}
                      />
                    </div>
                  </div>
                </div>

                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    {o.nextStep ? o.nextStep.slice(0, 110) : 'Add a next step'}
                  </summary>
                  <form action={save} className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="sm:col-span-2 text-xs">
                      <span className="mb-1 block font-medium">Next step</span>
                      <textarea name="nextStep" rows={2} defaultValue={o.nextStep ?? ''}
                        className="w-full rounded-md border border-input bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand" />
                    </label>
                    <label className="text-xs">
                      <span className="mb-1 block font-medium">Next step due</span>
                      <input type="date" name="nextStepDueAt" defaultValue={toInput(o.nextStepDueAt)}
                        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
                    </label>
                    <label className="text-xs">
                      <span className="mb-1 block font-medium">Date you promised them</span>
                      <input type="date" name="committedFollowUpAt" defaultValue={toInput(o.committedFollowUpAt)}
                        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
                    </label>
                    <label className="sm:col-span-2 text-xs">
                      <span className="mb-1 block font-medium">What you actually said</span>
                      <input type="text" name="committedTo" defaultValue={o.committedTo ?? ''}
                        placeholder="I'll send the outcome data after the board meeting"
                        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
                    </label>
                    <label className="text-xs">
                      <span className="mb-1 block font-medium">Quality</span>
                      <select name="leadQuality" defaultValue={o.leadQuality} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm">
                        {QUALITIES.map((x) => <option key={x} value={x}>{QUALITY_LABELS[x]}</option>)}
                      </select>
                    </label>
                    <label className="text-xs">
                      <span className="mb-1 block font-medium">Pin priority (0–100)</span>
                      <input type="number" name="priorityOverride" min={0} max={100} defaultValue={o.priorityOverride ?? ''}
                        placeholder="leave blank to compute"
                        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
                    </label>
                    <div className="sm:col-span-2">
                      <SubmitButton size="sm" pendingLabel="Saving…">Save lead</SubmitButton>
                    </div>
                  </form>
                </details>
              </li>
            )
          })}
        </ul>
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
