import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { VisitorsTrafficChart } from '@/components/admin/VisitorsTrafficChart'
import { AverageBarChart } from '@/components/admin/AverageBarChart'
import { classifyUserAgent, BOT_SIGNATURES } from '@/lib/http/user-agent'
import { classifyDevice, classifyBrowser } from '@/lib/http/device'
import { lookupIpLocation, formatIpLocation } from '@/lib/http/ip-geolocation'
import { formatAdminDateTime } from '@/lib/admin/format-date'
import { candidateDisplayName } from '@/lib/messaging/threads'
import { classifyTrafficSource } from '@/lib/marketing/classify-traffic-source'
import { byHourOfDay, byWeekday, perDaySeries, perHourSeries } from '@/lib/admin/visitor-time-buckets'

export const maxDuration = 30

const CHART_WINDOW_DAYS = 30

// Module-level, not inline in the component: react-hooks/purity flags Date.now().
function now(): Date {
  return new Date()
}

interface Row {
  id: string
  createdAt: Date
  ip: string | null
  eventType: 'PAGE_VIEW' | 'LINK_CLICK'
  path: string | null
  href: string | null
  referrer: string | null
  userAgent: string | null
  location: string | null
  candidate: { id: string; firstName: string | null; lastName: string | null } | null
  // Best-effort — set when this event's own candidateId is null (a session-
  // less, pre-signup or logged-out visit) but the IP matches exactly one
  // real candidate's CandidateProfile.signupIp. Never set when more than one
  // candidate shares that IP (a shared office network, a VPN) — an ambiguous
  // match is worse than none, so it falls back to the generic Human/Bot
  // label instead of guessing.
  inferredCandidate: { id: string; firstName: string | null; lastName: string | null } | null
  source: string
  device: string
}

// Who visited and when: the traffic chart, the weekday and hour-of-day charts,
// and the raw visit log. The aggregate stats live on the Visitors page.
export default async function AdminVisitorActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const rawParams = await searchParams
  const params = parseListParams(rawParams, [], 50)

  // Bots are hidden by default; `?bots=show` brings them back. Events with no
  // user agent stay visible — "unknown" is not "bot" (see classifyUserAgent).
  const showBots = rawParams.bots === 'show'
  const where = showBots
    ? {}
    : {
        OR: [
          { userAgent: null },
          { NOT: BOT_SIGNATURES.map((s) => ({ userAgent: { contains: s, mode: 'insensitive' as const } })) },
        ],
      }

  const current = now()
  const chartWindowStart = new Date(current.getTime() - CHART_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const [events, total, chartEvents] = await Promise.all([
    prisma.homepageVisitEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
      include: { candidate: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.homepageVisitEvent.count({ where }),
    prisma.homepageVisitEvent.findMany({
      where: { createdAt: { gte: chartWindowStart } },
      select: { createdAt: true, userAgent: true, ip: true, eventType: true },
      take: 100000,
    }),
  ])

  const trafficData = {
    day: { pageViews: perHourSeries(chartEvents, current, 24, false), uniqueVisitors: perHourSeries(chartEvents, current, 24, true) },
    '7d': { pageViews: perDaySeries(chartEvents, current, 7, false), uniqueVisitors: perDaySeries(chartEvents, current, 7, true) },
    '30d': { pageViews: perDaySeries(chartEvents, current, 30, false), uniqueVisitors: perDaySeries(chartEvents, current, 30, true) },
  }
  const colors = { views: 'var(--color-brand)', visitors: 'var(--color-warning)' }
  const weekdaySeries = [
    { label: 'Human page views', color: colors.views, buckets: byWeekday(chartEvents, current, CHART_WINDOW_DAYS, false) },
    { label: 'Unique visitors', color: colors.visitors, buckets: byWeekday(chartEvents, current, CHART_WINDOW_DAYS, true) },
  ]
  const hourSeries = (dayType: 'weekday' | 'weekend') => [
    { label: 'Human page views', color: colors.views, buckets: byHourOfDay(chartEvents, current, CHART_WINDOW_DAYS, false, dayType) },
    { label: 'Unique visitors', color: colors.visitors, buckets: byHourOfDay(chartEvents, current, CHART_WINDOW_DAYS, true, dayType) },
  ]

  // One lookup per unique IP on this page, not per row — same convention as
  // the daily digest email (send-homepage-visitor-digest.ts) — comfortably
  // stays under ip-api.com's free-tier rate limit even on a full 50-row page.
  const uniqueIps = Array.from(new Set(events.map((e) => e.ip).filter((ip): ip is string => !!ip)))
  const locationByIp = new Map(
    await Promise.all(uniqueIps.map(async (ip) => [ip, formatIpLocation(await lookupIpLocation(ip))] as const))
  )

  // Only worth looking up for events that don't already carry a confirmed,
  // session-based candidateId (see HomepageVisitEvent.candidateId's own
  // comment) — a pre-signup or logged-out visit from an IP we've since seen
  // a real candidate sign up from.
  const unmatchedIps = Array.from(
    new Set(events.filter((e) => !e.candidateId && e.ip).map((e) => e.ip as string))
  )
  const signupMatches =
    unmatchedIps.length > 0
      ? await prisma.candidateProfile.findMany({
          where: { signupIp: { in: unmatchedIps } },
          select: { id: true, firstName: true, lastName: true, signupIp: true },
        })
      : []
  const candidatesByIp = new Map<string, typeof signupMatches>()
  for (const c of signupMatches) {
    if (!c.signupIp) continue
    candidatesByIp.set(c.signupIp, [...(candidatesByIp.get(c.signupIp) ?? []), c])
  }
  // Ambiguous (more than one candidate ever signed up from this IP — a
  // shared office network, a VPN exit node) is worse than no match at all.
  const inferredCandidateByIp = new Map(
    Array.from(candidatesByIp.entries())
      .filter(([, candidates]) => candidates.length === 1)
      .map(([ip, candidates]) => [ip, candidates[0]])
  )

  const rows: Row[] = events.map((e) => ({
    id: e.id,
    createdAt: e.createdAt,
    ip: e.ip,
    eventType: e.eventType,
    path: e.path,
    href: e.href,
    referrer: e.referrer,
    userAgent: e.userAgent,
    location: e.ip ? (locationByIp.get(e.ip) ?? null) : null,
    candidate: e.candidate,
    inferredCandidate: !e.candidate && e.ip ? (inferredCandidateByIp.get(e.ip) ?? null) : null,
    source: e.eventType === 'PAGE_VIEW' ? classifyTrafficSource(e.path, e.referrer) : '—',
    device: classifyDevice(e.userAgent),
  }))

  const result = paginatedResult(rows, total, params)

  const result = paginatedResult(rows, total, params)

  const columns: AdminColumn<Row>[] = [
    { header: 'Time', className: 'px-3 py-2 tabular-nums', render: (r) => formatAdminDateTime(r.createdAt) },
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
        if (r.inferredCandidate) {
          return (
            <>
              <Link
                href={`/support/admin/candidates/${r.inferredCandidate.id}`}
                className="text-primary underline underline-offset-4"
              >
                {candidateDisplayName(r.inferredCandidate)}
              </Link>
              <span className="text-muted-foreground"> (by IP)</span>
            </>
          )
        }
        const cls = classifyUserAgent(r.userAgent)
        return cls === 'bot' ? '🤖 Bot' : cls === 'human' ? '🧑 Human' : '❓ Unknown'
      },
    },
    { header: 'IP', render: (r) => r.ip ?? 'unknown' },
    { header: 'Location', render: (r) => r.location ?? '—' },
    {
      header: 'Detail',
      render: (r) =>
        r.eventType === 'LINK_CLICK' ? r.href ?? '—' : r.referrer ? `from ${r.referrer}` : 'direct / no referrer',
    },
    { header: 'Source', render: (r) => r.source },
    { header: 'Device', render: (r) => `${r.device} · ${classifyBrowser(r.userAgent)}` },
    {
      header: 'Page',
      render: (r) => (r.eventType === 'PAGE_VIEW' ? (r.path ?? '/ (recorded before path tracking)') : '—'),
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visitor activity</h1>
        <p className="mt-1 text-muted-foreground">
          {total} {showBots ? '' : 'human '}homepage visit events.{' '}
          <Link href="/support/admin/visitors" className="text-primary underline underline-offset-4">
            See the full visitor stats
          </Link>
          {' · '}
          <Link
            href={showBots ? '/support/admin/visitors/activity' : '/support/admin/visitors/activity?bots=show'}
            className="text-primary underline underline-offset-4"
          >
            {showBots ? 'Hide bots' : 'Show bots'}
          </Link>
        </p>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">Human page views &amp; unique visitors</h2>
        <VisitorsTrafficChart data={trafficData} />
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">By day of the week</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Average per day over the last {CHART_WINDOW_DAYS} days (Eastern time), so a weekday that occurs five times is not counted ahead of one that occurs four.
        </p>
        <AverageBarChart series={weekdaySeries} unit="per day" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium text-foreground">Weekdays, by hour of the day</h2>
          <p className="mb-3 text-xs text-muted-foreground">Monday to Friday, average per hour, Eastern time, last {CHART_WINDOW_DAYS} days.</p>
          <AverageBarChart series={hourSeries('weekday')} labelEvery={3} unit="per hour" />
        </div>
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium text-foreground">Weekends, by hour of the day</h2>
          <p className="mb-3 text-xs text-muted-foreground">Saturday and Sunday, average per hour, Eastern time, last {CHART_WINDOW_DAYS} days.</p>
          <AverageBarChart series={hourSeries('weekend')} labelEvery={3} unit="per hour" />
        </div>
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
          basePath: '/support/admin/visitors/activity',
          baseParams: showBots ? { bots: 'show' } : {},
        }}
      />
    </div>
  )
}
