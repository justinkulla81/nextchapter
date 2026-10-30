import Link from 'next/link'
import { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { VisitorsTrafficChart } from '@/components/admin/VisitorsTrafficChart'
import { TrafficRangeProvider, VisitorsRangeSummary, type RangeTotals, type TrafficRange } from '@/components/admin/VisitorsActivityRange'
import { AverageBarChart } from '@/components/admin/AverageBarChart'
import { classifyUserAgent, BOT_SIGNATURES } from '@/lib/http/user-agent'
import { classifyDevice, classifyBrowser } from '@/lib/http/device'
import { lookupIpLocation, formatIpLocation } from '@/lib/http/ip-geolocation'
import { formatAdminDateTime } from '@/lib/admin/format-date'
import { adminCandidateLabel } from '@/lib/onboarding/details'
import { classifyTrafficSource } from '@/lib/marketing/classify-traffic-source'
import { extractEmailLinkId, resolveEmailRecipients, type EmailRecipient } from '@/lib/marketing/email-attribution'
import { allTimeDayCount, byHourOfDay, byWeekday, perDaySeries, perHourSeries } from '@/lib/admin/visitor-time-buckets'

export const maxDuration = 30

const CHART_WINDOW_DAYS = 30
// All time reads every event, newest first, up to this many. Past it the oldest are dropped and the chart says so.
const ALL_TIME_EVENT_CAP = 200_000
const DAY_MS = 24 * 60 * 60 * 1000

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
  candidate: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null
  // Best-effort — set when this event's own candidateId is null (a session-
  // less, pre-signup or logged-out visit) but the IP matches exactly one
  // real candidate's CandidateProfile.signupIp. Never set when more than one
  // candidate shares that IP (a shared office network, a VPN) — an ambiguous
  // match is worse than none, so it falls back to the generic Human/Bot
  // label instead of guessing.
  inferredCandidate: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null
  source: string
  // Set when the visit came from a tracked outbound email: the person it was sent to.
  recipient: EmailRecipient | null
  device: string
  // Per-IP totals across all of this visitor's recorded events (not just this row).
  views: number
  clicks: number
  applyClicks: number
  pageType: 'Job posting' | 'Site page'
  isApplyClick: boolean
}

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com').replace(/\/$/, '')
const OWN_HOST = new URL(SITE_URL).hostname.replace(/^www\./, '')
const SOCIAL_HOST = /(^|\.)(linkedin|facebook|twitter|x|instagram|youtube|tiktok)\.com$/i

// A single job's page (/jobs/<id>) is a "Job posting"; everything else — homepage, /jobs search, layoff, place and
// audience pages — is a "Site page".
function classifyPageType(path: string | null): Row['pageType'] {
  const pathname = (path ?? '').replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0]
  return /^\/jobs\/[^/]+/.test(pathname) ? 'Job posting' : 'Site page'
}

function absoluteUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value
  return `${SITE_URL}${value.startsWith('/') ? '' : '/'}${value}`
}

// A click on a job page (or an old click with no page recorded) that leaves for an outside, non-social site is the
// Apply button — it opens the employer's own page. Clicks recorded before path tracking is the estimate part.
function isApplyClick(eventType: string, href: string | null, path: string | null): boolean {
  if (eventType !== 'LINK_CLICK' || !href || !/^https?:\/\//i.test(href)) return false
  try {
    const host = new URL(href).hostname.replace(/^www\./, '')
    if (host === OWN_HOST || SOCIAL_HOST.test(host)) return false
  } catch {
    return false
  }
  return path === null || path.startsWith('/jobs/')
}

function FullUrl({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-primary underline underline-offset-4">
      {url}
    </a>
  )
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
  const botPatterns = BOT_SIGNATURES.map((sig) => `%${sig}%`)
  const botFilter = showBots ? Prisma.sql`TRUE` : Prisma.sql`("userAgent" IS NULL OR NOT ("userAgent" ILIKE ANY(${botPatterns})))`
  const since = (days: number) => new Date(current.getTime() - days * DAY_MS)

  const [events, total, chartEvents, totalsRows] = await Promise.all([
    prisma.homepageVisitEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
      include: { candidate: { select: { id: true, firstName: true, lastName: true, email: true } } },
    }),
    prisma.homepageVisitEvent.count({ where }),
    prisma.homepageVisitEvent.findMany({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, userAgent: true, ip: true, eventType: true },
      take: ALL_TIME_EVENT_CAP,
    }),
    // The count under the title, for each range the chart offers: events and distinct visitors, same bot rule as the log.
    prisma.$queryRaw<{ e1: bigint; v1: bigint; e7: bigint; v7: bigint; e30: bigint; v30: bigint; eall: bigint; vall: bigint }[]>(Prisma.sql`
      SELECT
        count(*) FILTER (WHERE "createdAt" >= ${since(1)}) AS e1,
        count(DISTINCT "ip") FILTER (WHERE "createdAt" >= ${since(1)}) AS v1,
        count(*) FILTER (WHERE "createdAt" >= ${since(7)}) AS e7,
        count(DISTINCT "ip") FILTER (WHERE "createdAt" >= ${since(7)}) AS v7,
        count(*) FILTER (WHERE "createdAt" >= ${since(30)}) AS e30,
        count(DISTINCT "ip") FILTER (WHERE "createdAt" >= ${since(30)}) AS v30,
        count(*) AS eall,
        count(DISTINCT "ip") AS vall
      FROM "HomepageVisitEvent"
      WHERE ${botFilter}`),
  ])

  const t = totalsRows[0]
  const totals: Record<TrafficRange, RangeTotals> = {
    day: { events: Number(t?.e1 ?? 0), visitors: Number(t?.v1 ?? 0) },
    '7d': { events: Number(t?.e7 ?? 0), visitors: Number(t?.v7 ?? 0) },
    '30d': { events: Number(t?.e30 ?? 0), visitors: Number(t?.v30 ?? 0) },
    all: { events: Number(t?.eall ?? 0), visitors: Number(t?.vall ?? 0) },
  }
  const allTimeDays = allTimeDayCount(chartEvents, current)

  const trafficData = {
    day: { pageViews: perHourSeries(chartEvents, current, 24, false), uniqueVisitors: perHourSeries(chartEvents, current, 24, true) },
    '7d': { pageViews: perDaySeries(chartEvents, current, 7, false), uniqueVisitors: perDaySeries(chartEvents, current, 7, true) },
    '30d': { pageViews: perDaySeries(chartEvents, current, 30, false), uniqueVisitors: perDaySeries(chartEvents, current, 30, true) },
    all: { pageViews: perDaySeries(chartEvents, current, allTimeDays, false), uniqueVisitors: perDaySeries(chartEvents, current, allTimeDays, true) },
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
          select: { id: true, firstName: true, lastName: true, email: true, signupIp: true },
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

  const recipientByLink = await resolveEmailRecipients(events.map((e) => extractEmailLinkId(e.path)).filter((id): id is string => !!id))

  // Per-person totals: one row per IP, same bot rule as the log. "Person" is an IP — the best identity an
  // anonymous visit carries.
  const totalsByIp = new Map<string, { views: number; clicks: number; applyClicks: number }>()
  if (uniqueIps.length > 0) {
    const [ipEvents] = await Promise.all([
      prisma.$queryRaw<{ ip: string; eventType: string; href: string | null; path: string | null }[]>(Prisma.sql`
        SELECT "ip", "eventType"::text AS "eventType", "href", "path"
        FROM "HomepageVisitEvent"
        WHERE "ip" = ANY(${uniqueIps}) AND ${botFilter}`),
    ])
    for (const ev of ipEvents) {
      const t = totalsByIp.get(ev.ip) ?? { views: 0, clicks: 0, applyClicks: 0 }
      if (ev.eventType === 'PAGE_VIEW') t.views += 1
      else {
        t.clicks += 1
        if (isApplyClick(ev.eventType, ev.href, ev.path)) t.applyClicks += 1
      }
      totalsByIp.set(ev.ip, t)
    }
  }

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
    recipient: (() => {
      const id = extractEmailLinkId(e.path)
      return id ? (recipientByLink.get(id) ?? null) : null
    })(),
    device: classifyDevice(e.userAgent),
    views: e.ip ? (totalsByIp.get(e.ip)?.views ?? 0) : 0,
    clicks: e.ip ? (totalsByIp.get(e.ip)?.clicks ?? 0) : 0,
    applyClicks: e.ip ? (totalsByIp.get(e.ip)?.applyClicks ?? 0) : 0,
    pageType: classifyPageType(e.path),
    isApplyClick: isApplyClick(e.eventType, e.href, e.path),
  }))

  const result = paginatedResult(rows, total, params)

  const columns: AdminColumn<Row>[] = [
    { header: 'Time', className: 'px-3 py-2 tabular-nums', render: (r) => formatAdminDateTime(r.createdAt) },
    {
      header: 'Visitor',
      render: (r) => {
        if (r.recipient) {
          return (
            <>
              <Link href={`/support/admin/crm/people/${r.recipient.personId}`} className="text-primary underline underline-offset-4">
                {r.recipient.name}
              </Link>
              <span className="text-muted-foreground"> (clicked our email)</span>
            </>
          )
        }
        if (r.candidate) {
          return (
            <Link href={`/support/admin/candidates/${r.candidate.id}`} className="text-primary underline underline-offset-4">
              {adminCandidateLabel(r.candidate)}
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
                {adminCandidateLabel(r.inferredCandidate)}
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
      header: 'This person total',
      className: 'px-3 py-2 tabular-nums',
      render: (r) => (r.ip ? `${r.views} views · ${r.clicks} clicks · ${r.applyClicks} apply` : '—'),
    },
    {
      header: 'Came from',
      render: (r) =>
        r.eventType === 'PAGE_VIEW' ? (r.referrer ? <FullUrl url={r.referrer} /> : 'direct / no referrer') : '—',
    },
    {
      header: 'Clicked',
      render: (r) =>
        r.eventType === 'LINK_CLICK' && r.href ? (
          <>
            {r.isApplyClick && <span className="mr-1 font-medium text-success">Apply ✓</span>}
            <FullUrl url={absoluteUrl(r.href)} />
          </>
        ) : (
          '—'
        ),
    },
    { header: 'Source', render: (r) => (r.recipient ? `Email to ${r.recipient.name}` : r.source) },
    { header: 'Device', render: (r) => `${r.device} · ${classifyBrowser(r.userAgent)}` },
    { header: 'Page type', render: (r) => r.pageType },
    {
      header: 'Page',
      render: (r) =>
        r.path ? <FullUrl url={absoluteUrl(r.path)} /> : r.eventType === 'PAGE_VIEW' ? '/ (recorded before path tracking)' : '—',
    },
  ]

  return (
    <div className="mx-auto max-w-[1800px] space-y-6 p-6">
      <TrafficRangeProvider>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visitor activity</h1>
        <p className="mt-1 text-muted-foreground">
          <VisitorsRangeSummary totals={totals} showBots={showBots} />{' '}
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
        <VisitorsTrafficChart data={trafficData} allTimeTruncated={chartEvents.length >= ALL_TIME_EVENT_CAP} />
      </div>
      </TrafficRangeProvider>

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
