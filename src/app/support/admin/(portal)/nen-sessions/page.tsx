import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { getAuthEmail, listAllAuthUsers } from '@/lib/admin/auth-users'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { CRUCIBLE_VARIANTS } from '@/lib/crucible/variants'
import { cn } from '@/lib/utils'

export const maxDuration = 30

interface Row {
  id: string
  displayName: string
  score: number | null
  band: string | null
  branch: string | null
  source: string
  variantLabel: string
  hasSharedResume: boolean
  startedAt: Date
  isRetry: boolean
}

const BRANCH_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All branches' },
  { value: 'PASS', label: 'Pass' },
  { value: 'GROWTH', label: 'Growth' },
]

const SOURCE_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All sources' },
  { value: 'LANDING', label: 'Landing (anonymous)' },
  { value: 'NC_NEWGRAD', label: 'NC New Grad' },
  { value: 'NC_ASSESSMENT', label: 'NC Assessment' },
]

function buildFilterHref(current: Record<string, string>, key: string, value: string): string {
  const next = { ...current }
  if (value) next[key] = value
  else delete next[key]
  const qs = new URLSearchParams(next).toString()
  return qs ? `/support/admin/nen-sessions?${qs}` : '/support/admin/nen-sessions'
}

export default async function AdminNenSessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const rawParams = await searchParams
  const params = parseListParams(rawParams, ['branch', 'source'], 25)

  const where = {
    ...(params.filters.branch ? { branch: params.filters.branch as 'PASS' | 'GROWTH' } : {}),
    ...(params.filters.source ? { source: params.filters.source as 'LANDING' | 'NC_NEWGRAD' | 'NC_ASSESSMENT' } : {}),
  }

  const [sessions, total, authUsers] = await Promise.all([
    prisma.crucibleSession.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        email: true,
        candidateId: true,
        candidate: { select: { firstName: true, lastName: true, userId: true } },
        source: true,
        variant: true,
        score: true,
        band: true,
        branch: true,
        resumeFilePath: true,
        resumeShareConsent: true,
        startedAt: true,
        retryOfId: true,
      },
    }),
    prisma.crucibleSession.count({ where }),
    listAllAuthUsers(),
  ])

  const rows: Row[] = sessions.map((s) => {
    const displayName = s.candidate
      ? [s.candidate.firstName, s.candidate.lastName].filter(Boolean).join(' ') ||
        getAuthEmail(authUsers, s.candidate.userId)
      : (s.email ?? '— (anonymous)')

    return {
      id: s.id,
      displayName,
      score: s.score,
      band: s.band,
      branch: s.branch,
      source: s.source,
      variantLabel: s.variant ? CRUCIBLE_VARIANTS[s.variant].label : '—',
      hasSharedResume: !!s.resumeFilePath && s.resumeShareConsent,
      startedAt: s.startedAt,
      isRetry: !!s.retryOfId,
    }
  })

  const columns: AdminColumn<Row>[] = [
    {
      header: 'Candidate',
      render: (r) => (
        <span className="flex items-center gap-2">
          <Link href={`/support/admin/nen-sessions/${r.id}`} className="text-primary underline underline-offset-4">
            {r.displayName}
          </Link>
          {r.isRetry && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Retry</span>
          )}
        </span>
      ),
    },
    { header: 'Score', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.score ?? '—' },
    { header: 'Band', render: (r) => r.band ?? '—' },
    { header: 'Branch', render: (r) => r.branch ?? '—' },
    { header: 'Source', render: (r) => r.source },
    { header: 'Discipline', render: (r) => r.variantLabel },
    { header: 'Resume shared', render: (r) => (r.hasSharedResume ? 'Yes' : 'No') },
    { header: 'Started', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.startedAt.toLocaleDateString() },
  ]

  const result = paginatedResult(rows, total, params)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">NEN Sessions</h1>
        <p className="mt-1 text-muted-foreground">{total} noexperienceneeded.ai assessment sessions.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {BRANCH_FILTERS.map((f) => (
          <Link
            key={f.label}
            href={buildFilterHref(params.filters, 'branch', f.value)}
            className={cn(
              'rounded-md border border-border px-3 py-1.5 text-sm',
              (params.filters.branch ?? '') === f.value ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/50'
            )}
          >
            {f.label}
          </Link>
        ))}
        <span className="mx-1 self-center text-muted-foreground">·</span>
        {SOURCE_FILTERS.map((f) => (
          <Link
            key={f.label}
            href={buildFilterHref(params.filters, 'source', f.value)}
            className={cn(
              'rounded-md border border-border px-3 py-1.5 text-sm',
              (params.filters.source ?? '') === f.value ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/50'
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
        emptyMessage="No sessions match this filter."
        pagination={{
          page: result.page,
          totalPages: result.totalPages,
          total: result.total,
          basePath: '/support/admin/nen-sessions',
          baseParams: params.filters,
        }}
      />
    </div>
  )
}
