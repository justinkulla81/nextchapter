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
  specialty: string | null
  hasLogin: boolean
  submissions: number
  createdAt: Date
  isTestAccount: boolean
}

export default async function AdminRecruitersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const rawParams = await searchParams
  const params = parseListParams(rawParams, [], 25)

  const [recruiters, total] = await Promise.all([
    prisma.recruiter.findMany({
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        fullName: true,
        workEmail: true,
        firmName: true,
        specialty: true,
        userId: true,
        createdAt: true,
        isSampleData: true,
        _count: { select: { jobBoardSubmissions: true } },
      },
    }),
    prisma.recruiter.count(),
  ])

  const rows: Row[] = recruiters.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    workEmail: r.workEmail,
    firmName: r.firmName,
    specialty: r.specialty,
    hasLogin: r.userId !== null,
    submissions: r._count.jobBoardSubmissions,
    createdAt: r.createdAt,
    isTestAccount: r.isSampleData,
  }))

  const columns: AdminColumn<Row>[] = [
    {
      header: 'Name',
      render: (r) => (
        <span className="flex items-center gap-2">
          <Link href={`/support/admin/recruiters/${r.id}`} className="text-primary underline underline-offset-4">
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
    { header: 'Specialty', render: (r) => r.specialty ?? '—' },
    { header: 'Login', render: (r) => (r.hasLogin ? 'Yes' : 'Token-only') },
    { header: 'Submissions', render: (r) => r.submissions },
    { header: 'Joined', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.createdAt.toLocaleDateString() },
  ]

  const result = paginatedResult(rows, total, params)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recruiters</h1>
        <p className="mt-1 text-muted-foreground">{total} recruiter accounts.</p>
      </div>
      <AdminDataTable
        columns={columns}
        rows={result.rows}
        rowKey={(r) => r.id}
        emptyMessage="No recruiters yet."
        pagination={{
          page: result.page,
          totalPages: result.totalPages,
          total: result.total,
          basePath: '/support/admin/recruiters',
          baseParams: {},
        }}
      />
    </div>
  )
}
