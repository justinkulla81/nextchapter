import Link from 'next/link'
import { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { VisitorsTrafficChart } from '@/components/admin/VisitorsTrafficChart'
import { TrafficRangeProvider, VisitorsRangeSummary, type RangeTotals, type TrafficRange } from '@/components/admin/VisitorsActivityRange'
import { AverageBarChart } from '@/components/admin/AverageBarChart'
import { VisitorsPerDayChart } from '@/components/admin/VisitorsPerDayChart'
import { loadCapturedEmailsForDays } from '@/lib/leads/captured-emails'
import { capturedPerDay, countsPerDay } from '@/lib/admin/captured-per-day'
import { loadPaidFunnel, loadSemEvents } from '@/lib/admin/sem-leads'
import { costLine, formatDollars, loadSemSpend } from '@/lib/admin/sem-spend'
import { PAID_CHANNELS, paidChannelLabel } from '@/lib/admin/paid-channels'
import { SemSpendForm } from '@/components/admin/SemSpendForm'
import { classifyUserAgent, BOT_SIGNATURES } from '@/lib/http/user-agent'
import { isDatacenterIp } from '@/lib/http/datacenter-ip'
import { loadScannerIps } from '@/lib/marketing/mail-scanners'
import { classifyDevice, classifyBrowser } from '@/lib/http/device'
import { lookupIpLocation, formatIpLocation } from '@/lib/http/ip-geolocation'
import { formatAdminShortDateTime } from '@/lib/admin/format-date'
import { adminCandidateLabel } from '@/lib/onboarding/details'
import { classifyTrafficSource } from '@/lib/marketing/classify-traffic-source'
import { buildEmailIpAnchors, extractEmailLinkId, extractUnsubscribeToken, IP_MATCH_WINDOW_MS, inferEmailLinkByIp, inferMailingTokenByIp, inferPersonByClickIp, loadRecipientsByPersonId, CLICK_TO_VISIT_WINDOW_MS, MAILING_IP_WINDOW_MS, resolveEmailRecipients, resolveMailingRecipients, type EmailRecipient, type MailingAnchor, type MailingClick } from '@/lib/marketing/email-attribution'
import { B2B_PORTAL_SECTIONS, CANDIDATE_PORTAL_SECTIONS, classifyVisitPage, isMutedVisitPageType, type VisitPageType } from '@/lib/admin/visit-page-type'
import { segmentRangeSeries, type SegmentCountRow } from '@/lib/admin/visitor-segment-series'
import { sourceSegment, type SourceSegment } from '@/lib/admin/visitor-source-segment'
import { VisitorsSegmentChart, type SegmentChartLine } from '@/components/admin/VisitorsSegmentChart'
import { etDateKey, allTimeDayCountFromFirstDay, byHourOfDayFromCounts, byWeekdayFromCounts, perDaySeriesFromCounts, perHourSeriesFromCounts } from '@/lib/admin/visitor-time-buckets'

export const maxDuration = 30

const CHART_WINDOW_DAYS = 30
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
  // Set when this visit has no tag of its own but its IP matches a tagged email visit within the past week.
  likelyRecipient: EmailRecipient | null
  // A mailing-list email visit whose token fits a few people and cannot be narrowed further.
  candidates: EmailRecipient[]
  // An IP that opens the links in emails to many different people: a mail scanner, never a person.
  scanner: boolean
  // Distinct recipients' unsubscribe links this IP has opened: a high number is a mail scanner shared by many people, not one person.
  mailRecipients: number
  // Emails this visitor gave us: the signup address of the account, or the address on a lead form submitted from the same IP.
  givenEmails: { email: string; how: string }[]
  // CRM people those emails (and the email recipient) belong to.
  crmPeople: { id: string; name: string }[]
  device: string
  // Per-IP totals across all of this visitor's recorded events (not just this row).
  views: number
  clicks: number
  applyClicks: number
  pageType: VisitPageType
  isApplyClick: boolean
}

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com').replace(/\/$/, '')
const OWN_HOST = new URL(SITE_URL).hostname.replace(/^www\./, '')
const SOCIAL_HOST = /(^|\.)(linkedin|facebook|twitter|x|instagram|youtube|tiktok)\.com$/i

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

// Link shown as host + path without the protocol, cut to one line; the full address is the hover text and the link target.
function ShortUrl({ url, max = 'max-w-[26ch]' }: { url: string; max?: string }) {
  const label = url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={url}
      className={`inline-block ${max} truncate align-bottom text-primary hover:underline`}
    >
      {label}
    </a>
  )
}

type LogRange = 'day' | 'week' | 'all'

function botFilterSql(showBots: boolean, scannerIps: Set<string>): Prisma.Sql {
  if (showBots) return Prisma.sql`TRUE`
  const patterns = BOT_SIGNATURES.map((sig) => `%${sig}%`)
  const notBot = Prisma.sql`("userAgent" IS NULL OR NOT ("userAgent" ILIKE ANY(${patterns})))`
  return scannerIps.size > 0 ? Prisma.sql`${notBot} AND ("ip" IS NULL OR NOT ("ip" = ANY(${Array.from(scannerIps)})))` : notBot
}

type LogEvent = Awaited<ReturnType<typeof prisma.homepageVisitEvent.findMany<{ include: { candidate: { select: { id: true; firstName: true; lastName: true; email: true } } } }>>>

type VisitorSort = 'clicks' | 'views'

// One row per visitor (an IP; an event with no IP stands alone), ordered by how many clicks or page views that visitor made in the
// window, then newest. The row shown is the visitor's latest event. One window query over the range's rows only.
async function loadEventsByVisitor(
  botFilter: Prisma.Sql,
  start: Date,
  skip: number,
  take: number,
  metric: VisitorSort
): Promise<{ events: LogEvent; total: number }> {
  const orderBy = metric === 'views' ? Prisma.sql`"views" DESC, "clicks" DESC` : Prisma.sql`"clicks" DESC, "views" DESC`
  const [ids, totalRows] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM (
        SELECT "id", "createdAt",
          count(*) FILTER (WHERE "eventType"::text = 'LINK_CLICK') OVER (PARTITION BY COALESCE("ip", "id")) AS "clicks",
          count(*) FILTER (WHERE "eventType"::text = 'PAGE_VIEW') OVER (PARTITION BY COALESCE("ip", "id")) AS "views",
          row_number() OVER (PARTITION BY COALESCE("ip", "id") ORDER BY "createdAt" DESC) AS "rn"
        FROM "HomepageVisitEvent"
        WHERE ${botFilter} AND "createdAt" >= ${start}
      ) t
      WHERE "rn" = 1
      ORDER BY ${orderBy}, "createdAt" DESC
      OFFSET ${skip} LIMIT ${take}`),
    prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
      SELECT count(DISTINCT COALESCE("ip", "id")) AS "n" FROM "HomepageVisitEvent" WHERE ${botFilter} AND "createdAt" >= ${start}`),
  ])
  const rows = await prisma.homepageVisitEvent.findMany({
    where: { id: { in: ids.map((r) => r.id) } },
    include: { candidate: { select: { id: true, firstName: true, lastName: true, email: true } } },
  })
  const order = new Map(ids.map((r, i) => [r.id, i] as const))
  return { events: rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)), total: Number(totalRows[0]?.n ?? 0) }
}

// Day / week and newest / most clicks: adjacent buttons (links), the current choice marked.
function LogControls({ range, sort, showBots }: { range: LogRange; sort: VisitorSort | null; showBots: boolean }) {
  const href = (r: LogRange, by: VisitorSort | null) => {
    const q = new URLSearchParams()
    if (showBots) q.set('bots', 'show')
    if (r !== 'all') q.set('range', r)
    if (by) q.set('sort', by)
    const qs = q.toString()
    return `/support/admin/visitors/activity${qs ? `?${qs}` : ''}`
  }
  const button = (active: boolean) =>
    `rounded-md border px-3 py-1.5 text-sm ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`
  const ranges: { key: LogRange; label: string }[] = [
    { key: 'day', label: 'Last 24 hours' },
    { key: 'week', label: 'Last 7 days' },
    { key: 'all', label: 'All time' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <nav aria-label="Time range" className="flex gap-2">
        {ranges.map((r) => (
          <Link key={r.key} href={href(r.key, sort)} aria-current={range === r.key ? 'true' : undefined} className={button(range === r.key)}>
            {r.label}
          </Link>
        ))}
      </nav>
      <nav aria-label="Sort order" className="flex gap-2">
        <Link href={href(range, null)} aria-current={!sort ? 'true' : undefined} className={button(!sort)}>
          Newest first
        </Link>
        <Link href={href(range, 'clicks')} aria-current={sort === 'clicks' ? 'true' : undefined} className={button(sort === 'clicks')}>
          Most clicks first
        </Link>
        <Link href={href(range, 'views')} aria-current={sort === 'views' ? 'true' : undefined} className={button(sort === 'views')}>
          Most views first
        </Link>
      </nav>
      {sort && range === 'all' && <p className="text-xs text-muted-foreground">Most clicks and most views look at the last 30 days, the longest span they count over. Each visitor (IP address) appears once.</p>}
      {sort && range !== 'all' && <p className="text-xs text-muted-foreground">Each visitor (IP address) appears once, on their latest visit.</p>}
    </div>
  )
}

// The title and organization of the person an email went to, on one truncated line under their name; the full text is the hover.
function RecipientOrg({ recipient }: { recipient: EmailRecipient }) {
  const line = [recipient.title, recipient.orgName].filter(Boolean).join(' at ')
  if (!line) return null
  return (
    <div className="truncate text-xs text-muted-foreground" title={line}>
      {line}
    </div>
  )
}

function referrerHost(referrer: string): string {
  try {
    return new URL(referrer).hostname.replace(/^www\./, '')
  } catch {
    return referrer
  }
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
  // Log filter: the last day or week, and newest first or most clicks first. The charts above always show their own ranges.
  const logRange: LogRange = rawParams.range === 'day' || rawParams.range === 'week' ? rawParams.range : 'all'
  const sort: VisitorSort | null = rawParams.sort === 'clicks' || rawParams.sort === 'views' ? rawParams.sort : null
  // Counting clicks or views per visitor is a window over the rows in range, so it never runs over the whole table: all time reads 30 days.
  const logDays = logRange === 'day' ? 1 : logRange === 'week' ? 7 : sort ? 30 : null
  const logStart = logDays ? new Date(now().getTime() - logDays * DAY_MS) : null
  const rangeWhere = logStart ? { createdAt: { gte: logStart } } : {}
  // Mail scanners are hidden with the bots: they open every link for every recipient, and are not people.
  const scannerIps = await loadScannerIps().catch(() => new Set<string>())
  const where = showBots
    ? rangeWhere
    : {
        ...rangeWhere,
        AND: [
          {
            OR: [
              { userAgent: null },
              { NOT: BOT_SIGNATURES.map((s) => ({ userAgent: { contains: s, mode: 'insensitive' as const } })) },
            ],
          },
          ...(scannerIps.size > 0 ? [{ OR: [{ ip: null }, { ip: { notIn: Array.from(scannerIps) } }] }] : []),
        ],
      }
  const etDay = Prisma.sql`to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York', 'YYYY-MM-DD')`
  const etHour = Prisma.sql`to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York', 'YYYY-MM-DD HH24')`

  const current = now()
  const botPatterns = BOT_SIGNATURES.map((sig) => `%${sig}%`)
  const botFilter = botFilterSql(showBots, scannerIps)
  const since = (days: number) => new Date(current.getTime() - days * DAY_MS)
  const rangeSql = logStart ? Prisma.sql`"createdAt" >= ${logStart}` : Prisma.sql`TRUE`

  // Human page views only (a known user agent that is not a bot), the series the charts have always drawn.
  const humanPageView = Prisma.sql`"eventType" = 'PAGE_VIEW' AND "userAgent" IS NOT NULL AND NOT ("userAgent" ILIKE ANY(${botPatterns}))`
  type BucketRow = { key: string; views: bigint; visitors: bigint }
  const [loaded, dayRows, hourRows, totalsRows] = await Promise.all([
    sort && logStart
      ? loadEventsByVisitor(botFilter, logStart, params.skip, params.take, sort)
      : prisma.homepageVisitEvent.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: params.skip,
          take: params.take,
          include: { candidate: { select: { id: true, firstName: true, lastName: true, email: true } } },
        }),
    // The charts read counts grouped by Eastern day and hour in the database, not every raw event.
    prisma.$queryRaw<BucketRow[]>(Prisma.sql`
      SELECT ${etDay} AS "key", count(*) AS "views", count(DISTINCT "ip") AS "visitors"
      FROM "HomepageVisitEvent" WHERE ${humanPageView} GROUP BY 1`),
    prisma.$queryRaw<BucketRow[]>(Prisma.sql`
      SELECT ${etHour} AS "key", count(*) AS "views", count(DISTINCT "ip") AS "visitors"
      FROM "HomepageVisitEvent" WHERE ${humanPageView} AND "createdAt" >= ${since(CHART_WINDOW_DAYS + 2)} GROUP BY 1`),
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

  const events = Array.isArray(loaded) ? loaded : loaded.events
  const t = totalsRows[0]
  const totals: Record<TrafficRange, RangeTotals> = {
    day: { events: Number(t?.e1 ?? 0), visitors: Number(t?.v1 ?? 0) },
    '7d': { events: Number(t?.e7 ?? 0), visitors: Number(t?.v7 ?? 0) },
    '30d': { events: Number(t?.e30 ?? 0), visitors: Number(t?.v30 ?? 0) },
    all: { events: Number(t?.eall ?? 0), visitors: Number(t?.vall ?? 0) },
  }
  // Same count the log is paginated by (the bot rule is the same SQL filter).
  const total = !Array.isArray(loaded) ? loaded.total : logDays === 1 ? totals.day.events : logDays === 7 ? totals['7d'].events : logDays === 30 ? totals['30d'].events : totals.all.events
  const toCounts = (rows: BucketRow[], field: 'views' | 'visitors') => new Map(rows.map((r) => [r.key, Number(r[field])] as const))
  const dayViews = toCounts(dayRows, 'views')
  const dayVisitors = toCounts(dayRows, 'visitors')
  const hourViews = toCounts(hourRows, 'views')
  const hourVisitors = toCounts(hourRows, 'visitors')
  const firstDayKey = dayRows.reduce<string | null>((min, r) => (min === null || r.key < min ? r.key : min), null)
  const allTimeDays = allTimeDayCountFromFirstDay(firstDayKey, current)

  const trafficData = {
    day: { pageViews: perHourSeriesFromCounts(hourViews, current, 24), uniqueVisitors: perHourSeriesFromCounts(hourVisitors, current, 24) },
    '7d': { pageViews: perDaySeriesFromCounts(dayViews, current, 7), uniqueVisitors: perDaySeriesFromCounts(dayVisitors, current, 7) },
    '30d': { pageViews: perDaySeriesFromCounts(dayViews, current, 30), uniqueVisitors: perDaySeriesFromCounts(dayVisitors, current, 30) },
    all: { pageViews: perDaySeriesFromCounts(dayViews, current, allTimeDays), uniqueVisitors: perDaySeriesFromCounts(dayVisitors, current, allTimeDays) },
  }

  // Portal use and outside-source traffic, split into segments. Grouped by (bucket, page or source, IP) in the database;
  // the segment of each group is decided in code with the same classifiers the visit log uses.
  const portalSections = [...CANDIDATE_PORTAL_SECTIONS, ...B2B_PORTAL_SECTIONS].map((s) => s.replace(/^\//, ''))
  const portalPath = Prisma.sql`"path" ~* ${`^/(${portalSections.join('|')})(/|\\?|#|$)`}`
  const sourcePath = Prisma.sql`("path" ~ '[?&]utm_source=' OR "path" ~ '[?&]nc_e=' OR "referrer" IS NOT NULL)`
  type PortalRow = { key: string; path: string; ip: string | null; views: bigint }
  type SourceRow = { key: string; utm: string | null; host: string | null; tagged: boolean; ip: string | null; views: bigint }
  const portalQuery = (bucket: Prisma.Sql, from: Date) =>
    prisma.$queryRaw<PortalRow[]>(Prisma.sql`
      SELECT ${bucket} AS "key", split_part("path", '?', 1) AS "path", "ip", count(*) AS "views"
      FROM "HomepageVisitEvent"
      WHERE ${humanPageView} AND ${portalPath} AND "createdAt" >= ${from}
      GROUP BY 1, 2, 3`)
  const sourceQuery = (bucket: Prisma.Sql, from: Date) =>
    prisma.$queryRaw<SourceRow[]>(Prisma.sql`
      SELECT ${bucket} AS "key",
        substring("path" from '[?&]utm_source=([^&#]*)') AS "utm",
        substring("referrer" from '^https?://([^/?#]+)') AS "host",
        ("path" ~ '[?&]nc_e=') AS "tagged",
        "ip", count(*) AS "views"
      FROM "HomepageVisitEvent"
      WHERE ${humanPageView} AND ${sourcePath} AND "createdAt" >= ${from}
      GROUP BY 1, 2, 3, 4, 5`)
  const epoch = new Date(0)
  const [portalDayRows, portalHourRows, sourceDayRows, sourceHourRows] = await Promise.all([
    portalQuery(etDay, epoch),
    portalQuery(etHour, since(2)),
    sourceQuery(etDay, epoch),
    sourceQuery(etHour, since(2)),
  ])
  const toSegmentRows = <R extends { key: string; ip: string | null; views: bigint }>(rows: R[], keep: (r: R) => boolean): SegmentCountRow[] =>
    rows.filter(keep).map((r) => ({ key: r.key, ip: r.ip, views: Number(r.views) }))
  const portalKinds = { Candidates: 'Candidate portal', 'B2B users': 'B2B portal' } as const
  const portalLines: SegmentChartLine[] = Object.entries(portalKinds).flatMap(([name, pageType], i) => {
    const keep = (r: PortalRow) => classifyVisitPage(r.path) === pageType
    const s = segmentRangeSeries(toSegmentRows(portalDayRows, keep), toSegmentRows(portalHourRows, keep), current, allTimeDays)
    const color = i === 0 ? 'var(--color-brand)' : 'var(--color-navy)'
    return [
      { label: `${name}: page views`, color, data: s.views },
      { label: `${name}: unique visitors`, color, dashed: true, data: s.visitors },
    ]
  })
  const sourceNames: SourceSegment[] = ['Social media', 'LinkedIn', 'Email']
  const sourceColors: Record<SourceSegment, string> = { 'Social media': 'var(--color-brand)', LinkedIn: 'var(--color-navy)', Email: 'var(--color-success)' }
  const sourceLines: SegmentChartLine[] = sourceNames.flatMap((name) => {
    const keep = (r: SourceRow) => sourceSegment(r.utm, r.host, r.tagged) === name
    const s = segmentRangeSeries(toSegmentRows(sourceDayRows, keep), toSegmentRows(sourceHourRows, keep), current, allTimeDays)
    return [
      { label: `${name}: page views`, color: sourceColors[name], data: s.views },
      { label: `${name}: unique visitors`, color: sourceColors[name], dashed: true, data: s.visitors },
    ]
  })

  const toDaysRows = (rows: { key: string; count: number }[]) => rows.map((d) => ({ dateKey: d.key, count: d.count }))
  // Emails captured per day: every form on the public site plus new registrations.
  // Seeded sample profiles and profiles with no email are not captures (332 were bulk-created on Oct 15).
  const [captured, registrationRows, applyClickRows, nativeApplicationRows, sem, paidFunnel] = await Promise.all([
    loadCapturedEmailsForDays(CHART_WINDOW_DAYS),
    prisma.candidateProfile.findMany({
      where: { createdAt: { gte: since(CHART_WINDOW_DAYS) }, isSampleData: false, email: { not: null } },
      select: { createdAt: true },
    }),
    prisma.homepageVisitEvent.findMany({
      where: { eventType: 'LINK_CLICK', createdAt: { gte: since(CHART_WINDOW_DAYS) }, href: { not: null }, path: { startsWith: '/jobs/' } },
      select: { createdAt: true, userAgent: true, href: true, path: true },
    }),
    prisma.nativeJobApplication.findMany({ where: { createdAt: { gte: since(CHART_WINDOW_DAYS) } }, select: { createdAt: true } }),
    loadSemEvents(CHART_WINDOW_DAYS),
    loadPaidFunnel(CHART_WINDOW_DAYS),
  ])
  const semDayKeys = countsPerDay([], current, CHART_WINDOW_DAYS).map((d) => d.key)
  const semSpend = await loadSemSpend(semDayKeys)
  const paidSum = (f: 'visitors' | 'emails' | 'accounts') => paidFunnel.reduce((t, r) => t + r[f], 0)
  const paidTotal = {
    channel: 'all' as const,
    visitors: paidSum('visitors'),
    emails: paidSum('emails'),
    accounts: paidSum('accounts'),
    emailRate: paidSum('visitors') ? paidSum('emails') / paidSum('visitors') : null,
    accountRate: paidSum('visitors') ? paidSum('accounts') / paidSum('visitors') : null,
  }
  const sumCents = (rows: { amountCents: number }[]) => rows.reduce((t, r) => t + r.amountCents, 0)
  const b2cLeads = sem.leads.filter((l) => !l.b2b)
  const b2bLeads = sem.leads.filter((l) => l.b2b)
  const channelCosts = PAID_CHANNELS.map((c) => ({
    channel: c,
    spend: semSpend.filter((r) => r.channel === c.key),
    line: costLine(
      c.label,
      sumCents(semSpend.filter((r) => r.channel === c.key)),
      sem.leads.filter((l) => l.channel === c.key).length,
      sem.accounts.filter((a) => a.channel === c.key).length
    ),
  })).filter((c) => c.spend.length > 0 || c.line.leads > 0 || c.line.accounts > 0)
  const semCosts = [
    ...channelCosts.map((c) => c.line),
    costLine('All paid', sumCents(semSpend), sem.leads.length, sem.accounts.length),
    costLine('B2C, all channels', sumCents(semSpend.filter((r) => r.segment === 'b2c')), b2cLeads.length, 0),
    costLine('B2B, all channels', sumCents(semSpend.filter((r) => r.segment === 'b2b')), b2bLeads.length, 0),
  ]
  const semSpendSeries = channelCosts
    .filter((c) => c.spend.length > 0)
    .map((c) => {
      const byDay = new Map<string, number>()
      for (const r of c.spend) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.amountCents / 100)
      return { label: `${c.channel.label} spend ($)`, days: semDayKeys.map((key) => ({ dateKey: key, count: byDay.get(key) ?? 0 })), color: c.channel.color }
    })
  const semSeries = [
    { label: 'B2C leads', days: toDaysRows(countsPerDay(b2cLeads.map((l) => l.at), current, CHART_WINDOW_DAYS)), color: 'var(--color-brand)' },
    { label: 'B2B leads', days: toDaysRows(countsPerDay(b2bLeads.map((l) => l.at), current, CHART_WINDOW_DAYS)), color: 'var(--color-navy)' },
    { label: 'Accounts created', days: toDaysRows(countsPerDay(sem.accounts.map((a) => a.at), current, CHART_WINDOW_DAYS)), color: 'var(--color-success)' },
  ]
  // Only clicks tied to a job page: clicks recorded before path tracking (to Oct 27) had no page, so they cannot be told from footer or news links.
  const humanApplyClicks = applyClickRows.filter(
    (e) => classifyUserAgent(e.userAgent) === 'human' && isApplyClick('LINK_CLICK', e.href, e.path)
  )
  const applicationSeries = [
    { label: 'Apply clicks (human)', days: toDaysRows(countsPerDay(humanApplyClicks.map((e) => e.createdAt), current, CHART_WINDOW_DAYS)), color: 'var(--color-success)' },
    { label: 'Applied in NextChapter', days: toDaysRows(countsPerDay(nativeApplicationRows.map((r) => r.createdAt), current, CHART_WINDOW_DAYS)), color: 'var(--color-navy)' },
  ]
  const capturedDays = capturedPerDay(captured, registrationRows.map((r) => r.createdAt), current, CHART_WINDOW_DAYS)
  const capturedSeries = [
    { label: 'All captured', days: toDaysRows(capturedDays.total), color: 'var(--color-navy)' },
    { label: 'Registrations', days: toDaysRows(capturedDays.registrations), color: 'var(--color-success)' },
    { label: 'Newsletter signups', days: toDaysRows(capturedDays.newsletter), color: 'var(--color-brand)' },
    { label: 'Saved jobs', days: toDaysRows(capturedDays.savedJobs), color: 'var(--color-warning)' },
  ]
  const colors = { views: 'var(--color-brand)', visitors: 'var(--color-warning)' }
  const weekdaySeries = [
    { label: 'Human page views', color: colors.views, buckets: byWeekdayFromCounts(dayViews, current, CHART_WINDOW_DAYS) },
    { label: 'Unique visitors', color: colors.visitors, buckets: byWeekdayFromCounts(dayVisitors, current, CHART_WINDOW_DAYS) },
  ]
  const hourSeries = (dayType: 'weekday' | 'weekend') => [
    { label: 'Human page views', color: colors.views, buckets: byHourOfDayFromCounts(hourViews, current, CHART_WINDOW_DAYS, dayType) },
    { label: 'Unique visitors', color: colors.visitors, buckets: byHourOfDayFromCounts(hourVisitors, current, CHART_WINDOW_DAYS, dayType) },
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

  // Tagged email visits from these IPs in the week before the oldest event shown: the anchors for the same-IP guess.
  const oldestShown = events.reduce((min, e) => (e.createdAt < min ? e.createdAt : min), new Date())
  const anchorVisits =
    uniqueIps.length > 0
      ? await prisma.homepageVisitEvent.findMany({
          where: {
            ip: { in: uniqueIps },
            eventType: 'PAGE_VIEW',
            path: { contains: 'nc_e=' },
            createdAt: { gte: new Date(oldestShown.getTime() - IP_MATCH_WINDOW_MS) },
          },
          select: { ip: true, path: true, createdAt: true, userAgent: true },
        })
      : []
  const ipAnchors = buildEmailIpAnchors(anchorVisits.filter((v) => classifyUserAgent(v.userAgent) === 'human' && !isDatacenterIp(v.ip)))
  const recipientByLink = await resolveEmailRecipients([
    ...events.map((e) => extractEmailLinkId(e.path)),
    ...Array.from(ipAnchors.values()).flatMap((list) => list.map((a) => a.linkId)),
  ].filter((id): id is string => !!id))

  // Mailing-list emails (the report, the newsletter): the unsubscribe link in the email names the recipient. A visit to it
  // identifies them; a visit from the same IP within five seconds (the mail scanner, or the person opening the report) is theirs too.
  const newest = events.reduce((max, e) => (e.createdAt > max ? e.createdAt : max), oldestShown)
  const unsubscribeVisits =
    uniqueIps.length > 0
      ? await prisma.homepageVisitEvent.findMany({
          where: {
            ip: { in: uniqueIps },
            path: { startsWith: '/updates/unsubscribe/' },
            createdAt: { gte: new Date(oldestShown.getTime() - MAILING_IP_WINDOW_MS), lte: new Date(newest.getTime() + MAILING_IP_WINDOW_MS) },
          },
          select: { ip: true, path: true, createdAt: true },
        })
      : []
  const mailingAnchors: MailingAnchor[] = unsubscribeVisits.flatMap((v) => {
    const token = extractUnsubscribeToken(v.path)
    return token ? [{ ip: v.ip, token, at: v.createdAt }] : []
  })
  const mailingMatches = await resolveMailingRecipients([
    ...events.map((e) => extractUnsubscribeToken(e.path)),
    ...mailingAnchors.map((a) => a.token),
  ].filter((t): t is string => !!t))
  const mailingByToken = mailingMatches.unique

  // Clicks Resend recorded on list-email links, from these IPs in the ten minutes before the oldest visit shown: the person who
  // clicked and the visit that follows from the same address. A missing table (before the migration) just means no clicks.
  const clickRows =
    uniqueIps.length > 0
      ? await prisma.mailingClickEvent
          .findMany({
            where: { bot: false, ip: { in: uniqueIps.filter((ip) => !scannerIps.has(ip) && !isDatacenterIp(ip)) }, clickedAt: { gte: new Date(oldestShown.getTime() - CLICK_TO_VISIT_WINDOW_MS), lte: newest } },
            select: { ip: true, clickedAt: true, recipient: { select: { personId: true } } },
          })
          .catch(() => [])
      : []
  const mailingClicks: MailingClick[] = clickRows.flatMap((c) => (c.recipient.personId ? [{ ip: c.ip, at: c.clickedAt, personId: c.recipient.personId }] : []))
  const clickPeople = await loadRecipientsByPersonId(mailingClicks.map((c) => c.personId))

  // Per-person totals: one row per IP, same bot rule as the log. "Person" is an IP — the best identity an
  // anonymous visit carries.
  const totalsByIp = new Map<string, { views: number; clicks: number; applyClicks: number; mail: number }>()
  if (uniqueIps.length > 0) {
    // Counts grouped in the database; only the clicks that leave the site are read row by row (to tell Apply clicks apart).
    const [countRows, clickRows] = await Promise.all([
      prisma.$queryRaw<{ ip: string; views: bigint; clicks: bigint; mail: bigint }[]>(Prisma.sql`
        SELECT "ip",
          count(DISTINCT substring("path" from '^/updates/unsubscribe/([A-Za-z0-9_-]+)')) AS "mail",
          count(*) FILTER (WHERE "eventType"::text = 'PAGE_VIEW') AS "views",
          count(*) FILTER (WHERE "eventType"::text <> 'PAGE_VIEW') AS "clicks"
        FROM "HomepageVisitEvent"
        WHERE "ip" = ANY(${uniqueIps}) AND ${botFilter} AND ${rangeSql}
        GROUP BY "ip"`),
      prisma.$queryRaw<{ ip: string; href: string | null; path: string | null }[]>(Prisma.sql`
        SELECT "ip", "href", "path"
        FROM "HomepageVisitEvent"
        WHERE "ip" = ANY(${uniqueIps}) AND "eventType"::text = 'LINK_CLICK' AND "href" ~* '^https?://' AND ${botFilter} AND ${rangeSql}`),
    ])
    for (const r of countRows) totalsByIp.set(r.ip, { views: Number(r.views), clicks: Number(r.clicks), applyClicks: 0, mail: Number(r.mail) })
    for (const ev of clickRows) {
      const t = totalsByIp.get(ev.ip)
      if (t && isApplyClick('LINK_CLICK', ev.href, ev.path)) t.applyClicks += 1
    }
  }

  // Who gave us an email: lead forms submitted from these IPs. An IP shared by several leads is still listed; the admin sees every address.
  const leadRows =
    uniqueIps.length > 0
      ? await prisma.homepageLead.findMany({
          where: { ip: { in: uniqueIps } },
          select: { ip: true, email: true, kind: true },
        })
      : []
  const leadsByIp = new Map<string, { email: string; how: string }[]>()
  for (const l of leadRows) {
    if (!l.ip) continue
    const how = l.kind === 'job_alert' ? 'job alert form' : 'journey form'
    const list = leadsByIp.get(l.ip) ?? []
    if (!list.some((x) => x.email.toLowerCase() === l.email.toLowerCase())) list.push({ email: l.email, how })
    leadsByIp.set(l.ip, list)
  }
  const givenEmailsFor = (e: (typeof events)[number]) => {
    const out: { email: string; how: string }[] = []
    const person = e.candidate ?? inferredCandidateByIp.get(e.ip ?? '')
    if (person?.email) out.push({ email: person.email, how: e.candidate ? 'account' : 'account, matched by IP' })
    for (const l of e.ip ? (leadsByIp.get(e.ip) ?? []) : []) {
      if (!out.some((x) => x.email.toLowerCase() === l.email.toLowerCase())) out.push(l)
    }
    return out
  }

  // Which of those addresses (and the people we emailed) are already in the CRM.
  const givenByEvent = new Map(events.map((e) => [e.id, givenEmailsFor(e)] as const))
  const emailsToCheck = Array.from(
    new Set(
      [
        ...Array.from(givenByEvent.values()).flat().map((g) => g.email),
        ...Array.from(recipientByLink.values()).map((r) => r.email ?? ''),
      ]
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
    )
  )
  const crmRows =
    emailsToCheck.length > 0
      ? await prisma.$queryRaw<{ id: string; fullName: string; email: string }[]>(Prisma.sql`
          SELECT DISTINCT ON (lower(e)) p."id", p."fullName", lower(e) AS "email"
          FROM "CrmPerson" p, LATERAL unnest(array_append(p."emails", p."email")) AS e
          WHERE lower(e) = ANY(${emailsToCheck})
          ORDER BY lower(e), p."createdAt" ASC`)
      : []
  const crmByEmail = new Map(crmRows.map((r) => [r.email, { id: r.id, name: r.fullName }] as const))

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
    scanner: !!e.ip && scannerIps.has(e.ip),
    recipient: (() => {
      if (e.ip && scannerIps.has(e.ip)) return null
      const id = extractEmailLinkId(e.path)
      if (id) return recipientByLink.get(id) ?? null
      const token = extractUnsubscribeToken(e.path)
      return token ? (mailingByToken.get(token) ?? null) : null
    })(),
    likelyRecipient: (() => {
      if (e.ip && scannerIps.has(e.ip)) return null
      if (!extractEmailLinkId(e.path) && !extractUnsubscribeToken(e.path)) {
        const clicked = inferPersonByClickIp(e, mailingClicks)
        if (clicked && clickPeople.has(clicked)) return clickPeople.get(clicked) ?? null
      }
      const mailToken = extractEmailLinkId(e.path) || extractUnsubscribeToken(e.path) ? null : inferMailingTokenByIp(e, mailingAnchors, (t) => mailingByToken.get(t)?.personId)
      if (mailToken) return mailingByToken.get(mailToken) ?? null
      if (classifyUserAgent(e.userAgent) !== 'human' || isDatacenterIp(e.ip)) return null
      const id = inferEmailLinkByIp(e, ipAnchors, (linkId) => recipientByLink.get(linkId)?.personId)
      return id ? (recipientByLink.get(id) ?? null) : null
    })(),
    candidates: (() => {
      if (e.ip && scannerIps.has(e.ip)) return []
      const token = extractUnsubscribeToken(e.path)
      return token && !mailingByToken.has(token) ? (mailingMatches.ambiguous.get(token) ?? []) : []
    })(),
    mailRecipients: e.ip ? (totalsByIp.get(e.ip)?.mail ?? 0) : 0,
    givenEmails: givenByEvent.get(e.id) ?? [],
    crmPeople: (() => {
      const found = new Map<string, { id: string; name: string }>()
      const link = extractEmailLinkId(e.path)
      const token = extractUnsubscribeToken(e.path)
      const recipient = e.ip && scannerIps.has(e.ip) ? null : link ? recipientByLink.get(link) : token ? mailingByToken.get(token) : null
      if (recipient) found.set(recipient.personId, { id: recipient.personId, name: recipient.name })
      for (const g of givenByEvent.get(e.id) ?? []) {
        const hit = crmByEmail.get(g.email.trim().toLowerCase())
        if (hit) found.set(hit.id, hit)
      }
      return Array.from(found.values())
    })(),
    device: classifyDevice(e.userAgent),
    views: e.ip ? (totalsByIp.get(e.ip)?.views ?? 0) : 0,
    clicks: e.ip ? (totalsByIp.get(e.ip)?.clicks ?? 0) : 0,
    applyClicks: e.ip ? (totalsByIp.get(e.ip)?.applyClicks ?? 0) : 0,
    pageType: classifyVisitPage(e.path),
    isApplyClick: isApplyClick(e.eventType, e.href, e.path),
  }))

  const result = paginatedResult(rows, total, params)

  const columns: AdminColumn<Row>[] = [
    { header: 'When', cellClassName: 'tabular-nums text-muted-foreground', render: (r) => formatAdminShortDateTime(r.createdAt) },
    {
      header: 'Visitor',
      cellClassName: 'max-w-[28ch]',
      render: (r) => {
        if (r.scanner) {
          return (
            <span
              className="font-medium text-muted-foreground"
              title={`This address opened the links in emails to ${r.mailRecipients} different people. It is a mail-security scanner checking their messages, not a person visiting.`}
            >
              📧 Mail scanner
            </span>
          )
        }
        const named = r.recipient ?? (!(r.candidate ?? r.inferredCandidate) ? r.likelyRecipient : null)
        if (named) {
          const certain = !!r.recipient
          return (
            <>
              <div className="truncate">
                <Link href={`/support/admin/crm/people/${named.personId}`} title={named.name} className="font-medium text-primary hover:underline">
                  {named.name}
                </Link>
                <span
                  className="text-muted-foreground"
                  title={certain ? 'The visit came through a link in an email we sent them.' : 'Same IP address, seconds or days from a visit that named them. A strong guess, not a certain match.'}
                >
                  {certain ? ' (emailed)' : ' (likely)'}
                </span>
              </div>
              <RecipientOrg recipient={named} />
            </>
          )
        }
        const person = r.candidate ?? r.inferredCandidate
        if (person) {
          return (
            <div className="truncate">
              <Link href={`/support/admin/candidates/${person.id}`} className="font-medium text-primary hover:underline">
                {adminCandidateLabel(person)}
              </Link>
              {!r.candidate && <span className="text-muted-foreground"> (by IP)</span>}
            </div>
          )
        }
        if (r.candidates.length > 0) {
          return (
            <div className="truncate text-xs" title={r.candidates.map((c) => c.name).join(', ')}>
              <span className="text-muted-foreground">One of: </span>
              {r.candidates.map((c, i) => (
                <span key={c.personId}>
                  {i > 0 && ', '}
                  <Link href={`/support/admin/crm/people/${c.personId}`} className="text-primary hover:underline">
                    {c.name}
                  </Link>
                </span>
              ))}
            </div>
          )
        }
        const cls = classifyUserAgent(r.userAgent)
        return <span className="font-medium">{cls === 'bot' ? '🤖 Bot' : cls === 'human' ? '🧑 Human' : '❓ Unknown'}</span>
      },
    },
    { header: 'Location', render: (r) => r.location ?? '—' },
    {
      header: 'Visits',
      cellClassName: 'tabular-nums',
      render: (r) =>
        !r.ip ? (
          '—'
        ) : r.scanner || r.mailRecipients >= 3 ? (
          <span
            className="text-muted-foreground"
            title={`This IP address opened the links in emails to ${r.mailRecipients} different people (${r.views} views, ${r.clicks} clicks in all). It is a mail scanner shared by many recipients, so its totals do not describe one person.`}
          >
            {r.scanner ? 'Mail scanner' : 'Shared IP'} · {r.mailRecipients} people
          </span>
        ) : (
          <span title={`${r.views} views, ${r.clicks} clicks, ${r.applyClicks} apply clicks from this IP`}>
            {r.views} <span className="text-muted-foreground">views</span> · {r.clicks} <span className="text-muted-foreground">clicks</span>
            {r.applyClicks > 0 && <span className="ml-1.5 font-medium text-success">{r.applyClicks} apply</span>}
          </span>
        ),
    },
    {
      header: 'Email and CRM',
      cellClassName: 'max-w-[20ch]',
      render: (r) => {
        const fromEmail = !!r.recipient || !!r.likelyRecipient
        if (!fromEmail && r.givenEmails.length === 0 && r.crmPeople.length === 0) return <span className="text-muted-foreground">—</span>
        return (
          <div className="space-y-0.5">
            {fromEmail && (
              <div>
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  {r.recipient ? 'From email' : 'Likely email'}
                </span>
              </div>
            )}
            {r.givenEmails.map((g) => (
              <div key={g.email} className="truncate text-xs" title={`Gave email (${g.how}): ${g.email}`}>
                <span className="font-medium">Gave</span> {g.email}
              </div>
            ))}
            {r.crmPeople.map((p) => (
              <div key={p.id} className="truncate text-xs">
                <span className="rounded bg-success/10 px-1.5 py-0.5 font-medium text-success">CRM</span>{' '}
                <Link href={`/support/admin/crm/people/${p.id}`} title={p.name} className="text-primary hover:underline">
                  {p.name}
                </Link>
              </div>
            ))}
          </div>
        )
      },
    },
    {
      header: 'Source',
      render: (r) =>
        r.recipient ? (
          `Email to ${r.recipient.name}`
        ) : r.eventType !== 'PAGE_VIEW' ? (
          '—'
        ) : (
          <span title={r.referrer ?? undefined}>
            {r.source}
            {r.referrer && <span className="text-muted-foreground"> · {referrerHost(r.referrer)}</span>}
          </span>
        ),
    },
    {
      header: 'Page or click',
      render: (r) => {
        if (r.eventType === 'LINK_CLICK' && r.href) {
          return (
            <>
              {r.isApplyClick && <span className="mr-1.5 rounded bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success">Apply</span>}
              <ShortUrl url={absoluteUrl(r.href)} max="max-w-[34ch]" />
            </>
          )
        }
        if (r.path) return <ShortUrl url={absoluteUrl(r.path)} max="max-w-[34ch]" />
        return r.eventType === 'PAGE_VIEW' ? <span className="text-muted-foreground">/ (before path tracking)</span> : '—'
      },
    },
    {
      header: 'Type',
      render: (r) => <span className={`whitespace-nowrap ${isMutedVisitPageType(r.pageType) ? 'text-muted-foreground' : ''}`}>{r.pageType}</span>,
    },
    {
      header: 'Device',
      cellClassName: 'text-muted-foreground',
      render: (r) => `${r.device} · ${classifyBrowser(r.userAgent)}`,
    },
    { header: 'IP', cellClassName: 'tabular-nums text-muted-foreground', render: (r) => r.ip ?? 'unknown' },
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
        <VisitorsTrafficChart data={trafficData} allTimeTruncated={false} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Portal use: candidates and B2B</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Logged-in portal pages only. Candidates are the candidate dashboard, membership, alumni plan and check-in pages; B2B users are the employer, recruiter, coach, college and workforce-board portals. Sign-in and sign-up pages are left out.
        </p>
        <VisitorsSegmentChart chart="portal_use" lines={portalLines} emptyMessage="No portal use in this window yet." />
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Social media, LinkedIn and email visits</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Visits that arrived from a social network (LinkedIn counted on its own line, not in Social media), or from an email: a tracked link in an email we sent, a utm_source of email, or a web mail referrer. Mail apps that hide the referrer on an untagged link show as Direct and are not counted here.
        </p>
        <VisitorsSegmentChart chart="social_linkedin_email" lines={sourceLines} emptyMessage="No visits from these sources in this window yet." />
      </div>
      </div>
      </TrafficRangeProvider>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium text-foreground">Paid leads, accounts and spend</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Last {CHART_WINDOW_DAYS} days (Eastern time). Visitors whose first visit came from a paid click on Google (a gclid, or a link tagged utm_medium cpc), Bing (msclkid), or a LinkedIn, Reddit or Facebook ad link tagged utm_medium paid_social, then left an email or created an account from the same IP within 30 days. An ad link with no tag is not counted, so tag every ad. B2B is a campaign tagged b2b-; every other click is B2C. Contact-form leads carry no IP, so they are not counted. Spend is typed in by day and channel; cost per lead is spend over the leads counted for that channel.
          </p>
          <VisitorsPerDayChart series={semSeries} emptyMessage="No paid leads in this window yet." />
          <h3 className="mb-1 mt-4 text-xs font-medium text-foreground">Spend and cost per lead by channel, last {CHART_WINDOW_DAYS} days</h3>
          <table className="mb-3 w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal"></th>
                <th className="py-1 pr-2 text-right font-normal">Spend</th>
                <th className="py-1 pr-2 text-right font-normal">Leads</th>
                <th className="py-1 pr-2 text-right font-normal">Cost per lead</th>
                <th className="py-1 text-right font-normal">Cost per account</th>
              </tr>
            </thead>
            <tbody>
              {semCosts.map((c) => (
                <tr key={c.label} className="border-t border-border">
                  <td className="py-1 pr-2">{c.label}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{formatDollars(c.spendCents)}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{c.leads}</td>
                  <td className="py-1 pr-2 text-right tabular-nums" title={c.costPerLeadCents === null ? 'No leads yet, so there is no cost per lead.' : undefined}>
                    {c.costPerLeadCents === null ? '—' : formatDollars(c.costPerLeadCents)}
                  </td>
                  <td className="py-1 text-right tabular-nums" title={c.costPerAccountCents === null ? 'No accounts yet.' : undefined}>
                    {c.costPerAccountCents === null ? '—' : formatDollars(c.costPerAccountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <VisitorsPerDayChart series={semSpendSeries} emptyMessage="No spend entered yet. Add a day below." />
          <SemSpendForm today={etDateKey(current)} windowStart={semDayKeys[0]} />
        </div>
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium text-foreground">Paid conversions by channel</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Visitors whose first paid click was in the last {CHART_WINDOW_DAYS} days, and how many of them left an email or created an account within 30 days of that click (same IP). Clicks from the last few days have not had the full 30 days yet, so the newest rates read low. The same person can be counted in both columns.
          </p>
          {paidFunnel.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paid clicks in this window yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2 font-normal">Channel</th>
                  <th className="py-1 pr-2 text-right font-normal">Paid visitors</th>
                  <th className="py-1 pr-2 text-right font-normal">Left an email</th>
                  <th className="py-1 text-right font-normal">Created an account</th>
                </tr>
              </thead>
              <tbody>
                {[...paidFunnel, ...(paidFunnel.length > 1 ? [paidTotal] : [])].map((f) => (
                  <tr key={f.channel} className="border-t border-border">
                    <td className="py-1 pr-2">{f.channel === 'all' ? 'All paid' : paidChannelLabel(f.channel)}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{f.visitors}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">
                      {f.emails} <span className="text-muted-foreground">({f.emailRate === null ? '—' : `${Math.round(f.emailRate * 100)}%`})</span>
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {f.accounts} <span className="text-muted-foreground">({f.accountRate === null ? '—' : `${Math.round(f.accountRate * 100)}%`})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium text-foreground">Emails captured per day</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Last {CHART_WINDOW_DAYS} days (Eastern time). All captured is every form on the site (journey picker, job alerts, saved jobs, newsletter, contact, guides, résumé, waitlists) plus new registrations with an email. Seeded sample profiles are left out.{' '}
            <Link href="/support/admin/captured-emails" className="text-primary underline underline-offset-4">
              See the list
            </Link>
          </p>
          <VisitorsPerDayChart series={capturedSeries} emptyMessage="No emails captured in this window yet." />
        </div>
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium text-foreground">Job applications per day</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Last {CHART_WINDOW_DAYS} days (Eastern time). Apply clicks are humans leaving a job page for the employer&apos;s own site, counted from Oct 27 when the site began recording which page a click came from; applied in NextChapter are applications sent through the platform.
          </p>
          <VisitorsPerDayChart series={applicationSeries} emptyMessage="No job applications in this window yet." />
        </div>
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

      <LogControls range={logRange} sort={sort} showBots={showBots} />

      <AdminDataTable
        columns={columns}
        rows={result.rows}
        rowKey={(r) => r.id}
        compact
        emptyMessage="No visitor activity recorded yet."
        pagination={{
          page: result.page,
          totalPages: result.totalPages,
          total: result.total,
          basePath: '/support/admin/visitors/activity',
          baseParams: { ...(showBots ? { bots: 'show' } : {}), ...(logRange !== 'all' ? { range: logRange } : {}), ...(sort ? { sort } : {}) },
        }}
      />
    </div>
  )
}
