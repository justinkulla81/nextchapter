import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { classifyUserAgent } from '@/lib/http/user-agent'
import { lookupIpLocation, formatIpLocation } from '@/lib/http/ip-geolocation'
import { formatAdminDateTime } from '@/lib/admin/format-date'
import { candidateDisplayName } from '@/lib/messaging/threads'

export const maxDuration = 30

interface Row {
  id: string
  createdAt: Date
  ip: string | null
  eventType: 'PAGE_VIEW' | 'LINK_CLICK'
  href: string | null
  referrer: string | null
  userAgent: string | null
  location: string | null
  candidate: { id: string; firstName: string | null; lastName: string | null } | null
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
      include: { candidate: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.homepageVisitEvent.count(),
  ])

  // One lookup per unique IP on this page, not per row — same convention as
  // the daily digest email (send-homepage-visitor-digest.ts) — comfortably
  // stays under ip-api.com's free-tier rate limit even on a full 50-row page.
  const uniqueIps = Array.from(new Set(events.map((e) => e.ip).filter((ip): ip is string => !!ip)))
  const locationByIp = new Map(
    await Promise.all(uniqueIps.map(async (ip) => [ip, formatIpLocation(await lookupIpLocation(ip))] as const))
  )

  const rows: Row[] = events.map((e) => ({
    id: e.id,
    createdAt: e.createdAt,
    ip: e.ip,
    eventType: e.eventType,
    href: e.href,
    referrer: e.referrer,
    userAgent: e.userAgent,
    location: e.ip ? (locationByIp.get(e.ip) ?? null) : null,
    candidate: e.candidate,
  }))

  const result = paginatedResult(rows, total, params)

  const columns: AdminColumn<Row>[] = [
    { header: 'Time', className: 'px-3 py-2 tabular-nums', render: (r) => formatAdminDateTime(r.createdAt) },
    { header: 'IP', render: (r) => r.ip ?? 'unknown' },
    { header: 'Location', render: (r) => r.location ?? '—' },
    { header: 'Event', render: (r) => (r.eventType === 'PAGE_VIEW' ? 'Homepage view' : 'Link click') },
    {
      header: 'Detail',
      render: (r) =>
        r.eventType === 'LINK_CLICK' ? r.href ?? '—' : r.referrer ? `from ${r.referrer}` : 'direct / no referrer',
    },
    {
      header: 'Visitor',
      render: (r) => {
        if (r.candidate) {
          return (
            <Link href={`/support/admin/candidates/${r.candidate.id}`} className="text-primary underline underline-offset-4">
              {candidateDisplayName(r.candidate)}
            </Link>
          )
        }
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
