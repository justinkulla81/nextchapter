import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { listAllAuthUsers, getAuthEmail } from '@/lib/admin/auth-users'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'

export const maxDuration = 30

interface Row {
  id: string
  name: string
  email: string
  companyName: string
  subscriptionTier: string
  rolesPosted: number
  createdAt: Date
  isTestAccount: boolean
}

export default async function AdminEmployersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const rawParams = await searchParams
  const params = parseListParams(rawParams, [], 25)

  const [employers, total, authUsers] = await Promise.all([
    prisma.employerProfile.findMany({
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        userId: true,
        contactName: true,
        companyName: true,
        subscriptionTier: true,
        createdAt: true,
        isSampleData: true,
        _count: { select: { roleProfiles: true } },
      },
    }),
    prisma.employerProfile.count(),
    listAllAuthUsers(),
  ])

  const rows: Row[] = employers.map((e) => ({
    id: e.id,
    name: e.contactName ?? '—',
    email: getAuthEmail(authUsers, e.userId),
    companyName: e.companyName,
    subscriptionTier: e.subscriptionTier,
    rolesPosted: e._count.roleProfiles,
    createdAt: e.createdAt,
    isTestAccount: e.isSampleData,
  }))

  const columns: AdminColumn<Row>[] = [
    {
      header: 'Contact',
      render: (r) => (
        <span className="flex items-center gap-2">
          <Link href={`/support/admin/employers/${r.id}`} className="text-primary underline underline-offset-4">
            {r.name}
          </Link>
          {r.isTestAccount && (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              Test account
            </span>
          )}
        </span>
      ),
    },
    { header: 'Company', render: (r) => r.companyName },
    { header: 'Email', render: (r) => r.email },
    { header: 'Tier', render: (r) => r.subscriptionTier },
    { header: 'Roles posted', render: (r) => r.rolesPosted },
    { header: 'Joined', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.createdAt.toLocaleDateString() },
  ]

  const result = paginatedResult(rows, total, params)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Employers</h1>
        <p className="mt-1 text-muted-foreground">{total} employer accounts.</p>
      </div>
      <AdminDataTable
        columns={columns}
        rows={result.rows}
        rowKey={(r) => r.id}
        emptyMessage="No employers yet."
        pagination={{
          page: result.page,
          totalPages: result.totalPages,
          total: result.total,
          basePath: '/support/admin/employers',
          baseParams: {},
        }}
      />
    </div>
  )
}
