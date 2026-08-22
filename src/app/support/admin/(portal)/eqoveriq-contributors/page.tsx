import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { getAuthEmail, listAllAuthUsers } from '@/lib/admin/auth-users'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { cn } from '@/lib/utils'

export const maxDuration = 30

const INTEREST_AREA_LABEL: Record<string, string> = {
  MODEL_EVALUATION: 'Model evaluation',
  RED_TEAMING: 'Red teaming',
  DATA_LABELING: 'Data labeling',
  PROMPT_ENGINEERING: 'Prompt engineering',
  RLHF: 'RLHF',
  FINE_TUNING: 'Fine-tuning',
  GENERALIST: 'Generalist',
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-warning/10 text-warning',
  APPROVED: 'bg-success/10 text-success',
  REJECTED: 'bg-destructive/10 text-destructive',
}

interface Row {
  id: string
  fullName: string
  email: string
  status: string
  interestAreas: string[]
  submittedAt: Date | null
  createdAt: Date
}

export default async function AdminEqOverIqContributorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const rawParams = await searchParams
  const params = parseListParams(rawParams, [], 25)

  const [contributors, total, authUsers] = await Promise.all([
    prisma.eqOverIqContributorProfile.findMany({
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        userId: true,
        fullName: true,
        status: true,
        interestAreas: true,
        submittedAt: true,
        createdAt: true,
      },
    }),
    prisma.eqOverIqContributorProfile.count(),
    listAllAuthUsers(),
  ])

  const rows: Row[] = contributors.map((c) => ({
    id: c.id,
    fullName: c.fullName ?? '—',
    email: getAuthEmail(authUsers, c.userId),
    status: c.status,
    interestAreas: c.interestAreas,
    submittedAt: c.submittedAt,
    createdAt: c.createdAt,
  }))

  const columns: AdminColumn<Row>[] = [
    {
      header: 'Name',
      render: (r) => (
        <Link href={`/support/admin/eqoveriq-contributors/${r.id}`} className="text-primary underline underline-offset-4">
          {r.fullName}
        </Link>
      ),
    },
    { header: 'Email', render: (r) => r.email },
    {
      header: 'Status',
      render: (r) => (
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[r.status])}>
          {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
        </span>
      ),
    },
    {
      header: 'Interest areas',
      render: (r) => (r.interestAreas.length > 0 ? r.interestAreas.map((a) => INTEREST_AREA_LABEL[a] ?? a).join(', ') : '—'),
    },
    {
      header: 'Submitted',
      className: 'px-3 py-2 font-medium tabular-nums',
      render: (r) => (r.submittedAt ? r.submittedAt.toLocaleDateString() : '—'),
    },
    { header: 'Joined', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.createdAt.toLocaleDateString() },
  ]

  const result = paginatedResult(rows, total, params)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">EQoverIQ Contributors</h1>
        <p className="mt-1 text-muted-foreground">{total} contributor accounts.</p>
      </div>
      <AdminDataTable
        columns={columns}
        rows={result.rows}
        rowKey={(r) => r.id}
        emptyMessage="No contributors yet."
        pagination={{
          page: result.page,
          totalPages: result.totalPages,
          total: result.total,
          basePath: '/support/admin/eqoveriq-contributors',
          baseParams: {},
        }}
      />
    </div>
  )
}
