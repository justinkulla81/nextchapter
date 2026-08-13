import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { RELATIONSHIP_TYPE_LABELS } from '@/lib/constants/references'
import { cn } from '@/lib/utils'
import type { ReferenceStatus } from '@prisma/client'

export const maxDuration = 30

const STATUS_STYLES: Record<ReferenceStatus, string> = {
  REQUESTED: 'bg-muted text-muted-foreground',
  REMINDER_SENT: 'bg-muted text-muted-foreground',
  COMPLETED: 'bg-primary/10 text-primary',
  DECLINED: 'bg-destructive/10 text-destructive',
  EXPIRED: 'bg-destructive/10 text-destructive',
}

interface Row {
  id: string
  candidateName: string
  candidateId: string
  refereeName: string
  relationship: string
  status: ReferenceStatus
  requestedAt: Date
  completedAt: Date | null
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'REQUESTED,REMINDER_SENT', label: 'Sent' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'EXPIRED', label: 'Expired' },
]

export default async function AdminReferencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const rawParams = await searchParams
  const params = parseListParams(rawParams, ['status'], 25)

  const statusFilter = params.filters.status
  const where = statusFilter ? { status: { in: statusFilter.split(',') as ReferenceStatus[] } } : {}

  const [references, total, sentCount, completedCount, declinedCount, expiredCount] = await Promise.all([
    prisma.reference.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      skip: params.skip,
      take: params.take,
      include: { candidate: { select: { id: true, displayName: true, firstName: true, lastName: true } } },
    }),
    prisma.reference.count({ where }),
    prisma.reference.count({ where: { status: { in: ['REQUESTED', 'REMINDER_SENT'] } } }),
    prisma.reference.count({ where: { status: 'COMPLETED' } }),
    prisma.reference.count({ where: { status: 'DECLINED' } }),
    prisma.reference.count({ where: { status: 'EXPIRED' } }),
  ])

  const rows: Row[] = references.map((r) => ({
    id: r.id,
    candidateName: r.candidate.displayName || [r.candidate.firstName, r.candidate.lastName].filter(Boolean).join(' ') || 'Unnamed',
    candidateId: r.candidate.id,
    refereeName: r.refereeName,
    relationship: RELATIONSHIP_TYPE_LABELS[r.relationshipType],
    status: r.status,
    requestedAt: r.requestedAt,
    completedAt: r.completedAt,
  }))

  const columns: AdminColumn<Row>[] = [
    {
      header: 'Candidate',
      render: (r) => (
        <Link href={`/support/admin/candidates/${r.candidateId}`} className="text-primary underline underline-offset-4">
          {r.candidateName}
        </Link>
      ),
    },
    {
      header: 'Referee',
      render: (r) => (
        <Link href={`/support/admin/references/${r.id}`} className="text-primary underline underline-offset-4">
          {r.refereeName}
        </Link>
      ),
    },
    { header: 'Relationship', render: (r) => r.relationship },
    {
      header: 'Status',
      render: (r) => (
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[r.status])}>
          {r.status === 'REMINDER_SENT' ? 'Requested' : r.status.charAt(0) + r.status.slice(1).toLowerCase()}
        </span>
      ),
    },
    { header: 'Sent', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.requestedAt.toLocaleDateString() },
    {
      header: 'Completed',
      className: 'px-3 py-2 font-medium tabular-nums',
      render: (r) => (r.completedAt ? r.completedAt.toLocaleDateString() : '—'),
    },
  ]

  const result = paginatedResult(rows, total, params)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">References</h1>
        <p className="mt-1 text-muted-foreground">
          {sentCount} awaiting response · {completedCount} completed · {declinedCount} declined
          {expiredCount > 0 && ` · ${expiredCount} expired`}
        </p>
      </div>

      <div className="flex gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/support/admin/references?status=${encodeURIComponent(f.value)}` : '/support/admin/references'}
            className={cn(
              'rounded-md border border-border px-3 py-1.5 text-sm',
              statusFilter === f.value || (!statusFilter && !f.value) ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/50'
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
        emptyMessage="No references match this filter."
        pagination={{
          page: result.page,
          totalPages: result.totalPages,
          total: result.total,
          basePath: '/support/admin/references',
          baseParams: statusFilter ? { status: statusFilter } : {},
        }}
      />
    </div>
  )
}
