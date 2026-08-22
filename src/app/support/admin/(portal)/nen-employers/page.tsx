import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { getAuthEmail, listAllAuthUsers } from '@/lib/admin/auth-users'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'

export const maxDuration = 30

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
  companyName: string
  contactName: string
  email: string
  functionInterest: string
  onboarded: boolean
  contestsCount: number
  resumeViewsCount: number
  suspended: boolean
  createdAt: Date
}

export default async function AdminNenEmployersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const rawParams = await searchParams
  const params = parseListParams(rawParams, [], 25)

  const [employers, total, authUsers] = await Promise.all([
    prisma.crucibleEmployerProfile.findMany({
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        userId: true,
        companyName: true,
        contactName: true,
        functionInterest: true,
        onboardingCompletedAt: true,
        suspendedAt: true,
        createdAt: true,
        _count: { select: { contests: true, resumeViews: true } },
      },
    }),
    prisma.crucibleEmployerProfile.count(),
    listAllAuthUsers(),
  ])

  const rows: Row[] = employers.map((e) => ({
    id: e.id,
    companyName: e.companyName,
    contactName: e.contactName ?? '—',
    email: getAuthEmail(authUsers, e.userId),
    functionInterest: e.functionInterest ? FUNCTION_INTEREST_LABEL[e.functionInterest] : 'Any',
    onboarded: !!e.onboardingCompletedAt,
    contestsCount: e._count.contests,
    resumeViewsCount: e._count.resumeViews,
    suspended: !!e.suspendedAt,
    createdAt: e.createdAt,
  }))

  const columns: AdminColumn<Row>[] = [
    {
      header: 'Company',
      render: (r) => (
        <span className="flex items-center gap-2">
          <Link href={`/support/admin/nen-employers/${r.id}`} className="text-primary underline underline-offset-4">
            {r.companyName}
          </Link>
          {r.suspended && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              Suspended
            </span>
          )}
        </span>
      ),
    },
    { header: 'Contact', render: (r) => r.contactName },
    { header: 'Email', render: (r) => r.email },
    { header: 'Function interest', render: (r) => r.functionInterest },
    { header: 'Onboarded', render: (r) => (r.onboarded ? 'Yes' : 'No') },
    { header: 'Contests', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.contestsCount },
    { header: 'Resume views', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.resumeViewsCount },
    { header: 'Joined', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.createdAt.toLocaleDateString() },
  ]

  const result = paginatedResult(rows, total, params)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">NEN Employers</h1>
        <p className="mt-1 text-muted-foreground">{total} noexperienceneeded.ai employer accounts.</p>
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
          basePath: '/support/admin/nen-employers',
          baseParams: {},
        }}
      />
    </div>
  )
}
