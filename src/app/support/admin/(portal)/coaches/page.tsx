import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { getCoachingSettings } from '@/lib/admin/coaching-settings'

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
  isOnCallBench: boolean
  avgRating: number | null
  ratedSessionCount: number
}

export default async function AdminCoachesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const rawParams = await searchParams
  const params = parseListParams(rawParams, [], 25)

  const [coaches, total, settings] = await Promise.all([
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
        isOnCallBench: true,
        _count: { select: { clients: true } },
        sessions: { select: { candidateRating: true }, orderBy: { occurredAt: 'desc' }, take: 20 },
      },
    }),
    prisma.coach.count(),
    getCoachingSettings(),
  ])

  const removalThreshold = settings.sessionRatingRemovalThreshold ? Number(settings.sessionRatingRemovalThreshold) : null

  const rows: Row[] = coaches.map((c) => {
    const rated = c.sessions.filter((s) => s.candidateRating !== null)
    const avgRating = rated.length > 0 ? rated.reduce((sum, s) => sum + (s.candidateRating ?? 0), 0) / rated.length : null
    return {
      id: c.id,
      fullName: c.fullName,
      workEmail: c.workEmail,
      firmName: c.firmName,
      focus: c.focus,
      hasLogin: c.userId !== null,
      clients: c._count.clients,
      createdAt: c.createdAt,
      isTestAccount: c.isSampleData,
      isOnCallBench: c.isOnCallBench,
      avgRating,
      ratedSessionCount: rated.length,
    }
  })

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
    { header: 'Bench', render: (r) => (r.isOnCallBench ? 'On call' : '—') },
    {
      header: 'Avg rating',
      render: (r) => {
        if (r.avgRating === null) return '—'
        const flagged = removalThreshold !== null && r.avgRating < removalThreshold
        return (
          <span className={flagged ? 'font-medium text-destructive' : undefined}>
            {r.avgRating.toFixed(1)} ({r.ratedSessionCount}){flagged && ' ⚠'}
          </span>
        )
      },
    },
    { header: 'Joined', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.createdAt.toLocaleDateString() },
  ]

  const result = paginatedResult(rows, total, params)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coaches</h1>
        <p className="mt-1 text-muted-foreground">
          {total} coach accounts.{' '}
          <Link href="/support/admin/coaching-reassignments" className="text-primary underline underline-offset-4">
            Reassignment queue &amp; surge outreach →
          </Link>
        </p>
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
