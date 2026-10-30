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
import { isDatacenterIp } from '@/lib/http/datacenter-ip'
import { classifyDevice, classifyBrowser } from '@/lib/http/device'
import { lookupIpLocation, formatIpLocation } from '@/lib/http/ip-geolocation'
import { formatAdminShortDateTime } from '@/lib/admin/format-date'
import { adminCandidateLabel } from '@/lib/onboarding/details'
import { classifyTrafficSource } from '@/lib/marketing/classify-traffic-source'
import { buildEmailIpAnchors, extractEmailLinkId, IP_MATCH_WINDOW_MS, inferEmailLinkByIp, resolveEmailRecipients, type EmailRecipient } from '@/lib/marketing/email-attribution'
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
  // Set when this visit has no tag of its own but its IP matches a tagged email visit within the past week.
  likelyRecipient: EmailRecipient | null
  // Emails this visitor gave us: the signup address of the account, or the address on a lead form submitted from the same IP.
  givenEmails: { email: string; how: string }[]
  // CRM people those emails (and the email recipient) belong to.
  crmPeople: { id: string; name: string }[]
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
    recipient: (() => {
      const id = extractEmailLinkId(e.path)
      return id ? (recipientByLink.get(id) ?? null) : null
    })(),
    likelyRecipient: (() => {
      if (classifyUserAgent(e.userAgent) !== 'human' || isDatacenterIp(e.ip)) return null
      const id = inferEmailLinkByIp(e, ipAnchors, (linkId) => recipientByLink.get(linkId)?.personId)
      return id ? (recipientByLink.get(id) ?? null) : null
    })(),
    givenEmails: givenByEvent.get(e.id) ?? [],
    crmPeople: (() => {
      const found = new Map<string, { id: string; name: string }>()
      const link = extractEmailLinkId(e.path)
      const recipient = link ? recipientByLink.get(link) : null
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
    pageType: classifyPageType(e.path),
    isApplyClick: isApplyClick(e.eventType, e.href, e.path),
  }))

  const result = paginatedResult(rows, total, params)

  const columns: AdminColumn<Row>[] = [
    { header: 'When', cellClassName: 'tabular-nums text-muted-foreground', render: (r) => formatAdminShortDateTime(r.createdAt) },
    {
      header: 'Visitor',
      render: (r) => {
        if (r.recipient) {
          return (
            <>
              <Link href={`/support/admin/crm/people/${r.recipient.personId}`} className="font-medium text-primary hover:underline">
                {r.recipient.name}
              </Link>
              <span className="text-muted-foreground"> (clicked our email)</span>
            </>
          )
        }
        const person = r.candidate ?? r.inferredCandidate
        if (!person && r.likelyRecipient) {
          return (
            <>
              <Link href={`/support/admin/crm/people/${r.likelyRecipient.personId}`} className="font-medium text-primary hover:underline">
                {r.likelyRecipient.name}
              </Link>
              <span className="text-muted-foreground" title="Same IP address as their email click within the past 7 days. A guess, not a certain match."> (likely, same IP as their email click)</span>
            </>
          )
        }
        if (person) {
          return (
            <>
              <Link href={`/support/admin/candidates/${person.id}`} className="font-medium text-primary hover:underline">
                {adminCandidateLabel(person)}
              </Link>
              {!r.candidate && <span className="text-muted-foreground"> (by IP)</span>}
            </>
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
        r.ip ? (
          <span title={`${r.views} views, ${r.clicks} clicks, ${r.applyClicks} apply clicks from this IP`}>
            {r.views} <span className="text-muted-foreground">views</span> · {r.clicks}{' '}
            <span className="text-muted-foreground">clicks</span>
            {r.applyClicks > 0 && <span className="ml-1.5 font-medium text-success">{r.applyClicks} apply</span>}
          </span>
        ) : (
          '—'
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
      header: 'Type',
      render: (r) => <span className={r.pageType === 'Job posting' ? '' : 'text-muted-foreground'}>{r.pageType}</span>,
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
        compact
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
