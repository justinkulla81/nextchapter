import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { cn } from '@/lib/utils'

export const maxDuration = 30

const STATE_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All states' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
]

const FUNCTION_INTEREST_LABEL: Record<string, string> = {
  TECH: 'Tech / Engineering',
  MARKETING: 'Marketing',
  DATA: 'Data / Analytics',
  DESIGN: 'Design',
  BUSINESS: 'Business / Operations',
  GENERALIST: 'Generalist',
}

interface Row {
  id: string
  title: string
  employerName: string
  state: string
  targetFunction: string
  entriesCount: number
  publishedAt: Date | null
  closedAt: Date | null
}

function buildFilterHref(current: Record<string, string>, key: string, value: string): string {
  const next = { ...current }
  if (value) next[key] = value
  else delete next[key]
  const qs = new URLSearchParams(next).toString()
  return qs ? `/support/admin/nen-contests?${qs}` : '/support/admin/nen-contests'
}

export default async function AdminNenContestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const rawParams = await searchParams
  const params = parseListParams(rawParams, ['state'], 25)

  const where = params.filters.state ? { state: params.filters.state as 'DRAFT' | 'OPEN' | 'CLOSED' } : {}

  const [contests, total] = await Promise.all([
    prisma.crucibleContest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        title: true,
        state: true,
        targetFunction: true,
        publishedAt: true,
        closedAt: true,
        employer: { select: { companyName: true } },
        _count: { select: { entries: true } },
      },
    }),
    prisma.crucibleContest.count({ where }),
  ])

  const rows: Row[] = contests.map((c) => ({
    id: c.id,
    title: c.title,
    employerName: c.employer.companyName,
    state: c.state,
    targetFunction: c.targetFunction ? FUNCTION_INTEREST_LABEL[c.targetFunction] : 'Any',
    entriesCount: c._count.entries,
    publishedAt: c.publishedAt,
    closedAt: c.closedAt,
  }))

  const columns: AdminColumn<Row>[] = [
    {
      header: 'Title',
      render: (r) => (
        <Link href={`/support/admin/nen-contests/${r.id}`} className="text-primary underline underline-offset-4">
          {r.title}
        </Link>
      ),
    },
    { header: 'Employer', render: (r) => r.employerName },
    { header: 'State', render: (r) => r.state },
    { header: 'Target function', render: (r) => r.targetFunction },
    { header: 'Entries', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.entriesCount },
    { header: 'Published', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => (r.publishedAt ? r.publishedAt.toLocaleDateString() : '—') },
    { header: 'Closed', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => (r.closedAt ? r.closedAt.toLocaleDateString() : '—') },
  ]

  const result = paginatedResult(rows, total, params)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">NEN Contests</h1>
        <p className="mt-1 text-muted-foreground">{total} employer-posted contests.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATE_FILTERS.map((f) => (
          <Link
            key={f.label}
            href={buildFilterHref(params.filters, 'state', f.value)}
            className={cn(
              'rounded-md border border-border px-3 py-1.5 text-sm',
              (params.filters.state ?? '') === f.value ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/50'
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <AdminDataTable
        columns={columns}
        rows={result.rows}
        rowKey={(r) => r.id}
        emptyMessage="No contests match this filter."
        pagination={{
          page: result.page,
          totalPages: result.totalPages,
          total: result.total,
          basePath: '/support/admin/nen-contests',
          baseParams: params.filters,
        }}
      />
    </div>
  )
}
