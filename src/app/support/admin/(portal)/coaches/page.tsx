import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'

export const maxDuration = 30

interface Row {
  id: string
  fullName: string
  workEmail: string
  firmName: string | null
  focus: string
  hasLogin: boolean
  clients: number
  createdAt: Date
  isTestAccount: boolean
}

export default async function AdminCoachesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const rawParams = await searchParams
  const params = parseListParams(rawParams, [], 25)

  const [coaches, total] = await Promise.all([
    prisma.coach.findMany({
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        fullName: true,
        workEmail: true,
        firmName: true,
        focus: true,
        userId: true,
        createdAt: true,
        isSampleData: true,
        _count: { select: { clients: true } },
      },
    }),
    prisma.coach.count(),
  ])

  const rows: Row[] = coaches.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    workEmail: c.workEmail,
    firmName: c.firmName,
    focus: c.focus,
    hasLogin: c.userId !== null,
    clients: c._count.clients,
    createdAt: c.createdAt,
    isTestAccount: c.isSampleData,
  }))

  const columns: AdminColumn<Row>[] = [
    {
      header: 'Name',
      render: (r) => (
        <span className="flex items-center gap-2">
          <Link href={`/support/admin/coaches/${r.id}`} className="text-primary underline underline-offset-4">
            {r.fullName}
          </Link>
          {r.isTestAccount && (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              Test account
            </span>
          )}
        </span>
      ),
    },
    { header: 'Firm', render: (r) => r.firmName ?? '—' },
    { header: 'Work email', render: (r) => r.workEmail },
    { header: 'Focus', render: (r) => r.focus },
    { header: 'Login', render: (r) => (r.hasLogin ? 'Yes' : 'Token-only') },
    { header: 'Clients', render: (r) => r.clients },
    { header: 'Joined', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.createdAt.toLocaleDateString() },
  ]

  const result = paginatedResult(rows, total, params)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coaches</h1>
        <p className="mt-1 text-muted-foreground">{total} coach accounts.</p>
      </div>
      <AdminDataTable
        columns={columns}
        rows={result.rows}
        rowKey={(r) => r.id}
        emptyMessage="No coaches yet."
        pagination={{
          page: result.page,
          totalPages: result.totalPages,
          total: result.total,
          basePath: '/support/admin/coaches',
          baseParams: {},
        }}
      />
    </div>
  )
}
