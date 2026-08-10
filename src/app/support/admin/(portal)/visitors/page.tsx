import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { classifyUserAgent } from '@/lib/http/user-agent'

export const maxDuration = 30

interface Row {
  id: string
  createdAt: Date
  ip: string | null
  eventType: 'PAGE_VIEW' | 'LINK_CLICK'
  href: string | null
  referrer: string | null
  userAgent: string | null
}

// Anonymous public-homepage traffic only — never candidate/coach/recruiter/
// admin app usage (that's the separate Login History on the candidate
// detail page). The site owner's own devices (TRUSTED_OWNER_IPS) are never
// recorded at all, so they never show up here.
export default async function AdminVisitorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const rawParams = await searchParams
  const params = parseListParams(rawParams, [], 50)

  const [events, total] = await Promise.all([
    prisma.homepageVisitEvent.findMany({
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    }),
    prisma.homepageVisitEvent.count(),
  ])

  const rows: Row[] = events.map((e) => ({
    id: e.id,
    createdAt: e.createdAt,
    ip: e.ip,
    eventType: e.eventType,
    href: e.href,
    referrer: e.referrer,
    userAgent: e.userAgent,
  }))

  const result = paginatedResult(rows, total, params)

  const columns: AdminColumn<Row>[] = [
    { header: 'Time', className: 'px-3 py-2 tabular-nums', render: (r) => r.createdAt.toLocaleString() },
    { header: 'IP', render: (r) => r.ip ?? 'unknown' },
    { header: 'Event', render: (r) => (r.eventType === 'PAGE_VIEW' ? 'Homepage view' : 'Link click') },
    {
      header: 'Detail',
      render: (r) =>
        r.eventType === 'LINK_CLICK' ? r.href ?? '—' : r.referrer ? `from ${r.referrer}` : 'direct / no referrer',
    },
    {
      header: 'Visitor',
      render: (r) => {
        const cls = classifyUserAgent(r.userAgent)
        return cls === 'bot' ? '🤖 Bot' : cls === 'human' ? '🧑 Human' : '❓ Unknown'
      },
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visitors</h1>
        <p className="mt-1 text-muted-foreground">
          {total} homepage visit events. A daily digest email also summarizes yesterday&apos;s traffic by IP.
        </p>
      </div>

      <AdminDataTable
        columns={columns}
        rows={result.rows}
        rowKey={(r) => r.id}
        emptyMessage="No visitor activity recorded yet."
        pagination={{
          page: result.page,
          totalPages: result.totalPages,
          total: result.total,
          basePath: '/support/admin/visitors',
          baseParams: {},
        }}
      />
    </div>
  )
}
