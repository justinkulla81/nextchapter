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
import { loadPaidFunnel } from '@/lib/admin/sem-leads'
import { paidChannelLabel } from '@/lib/admin/paid-channels'
import { classifyUserAgent, BOT_SIGNATURES } from '@/lib/http/user-agent'
import { DATACENTER_CIDRS, isDatacenterIp } from '@/lib/http/datacenter-ip'
import { loadBotClickNetworks, loadScannerIps } from '@/lib/marketing/mail-scanners'
import { classifyDevice, classifyBrowser } from '@/lib/http/device'
import { lookupIpLocation, formatIpLocation } from '@/lib/http/ip-geolocation'
import { formatAdminShortDateTime } from '@/lib/admin/format-date'
import { adminCandidateLabel } from '@/lib/onboarding/details'
import { classifyTrafficSource } from '@/lib/marketing/classify-traffic-source'
import { buildEmailIpAnchors, extractEmailLinkId, extractMailingRecipientId, resolveMailingRecipientIds, extractUnsubscribeToken, IP_MATCH_WINDOW_MS, inferEmailLinkByIp, inferMailingTokenByIp, inferPersonByClickIp, loadRecipientsByPersonId, CLICK_LEAD_WINDOW_MS, CLICK_TO_VISIT_WINDOW_MS, peopleByNearClick, NEAR_CLICK_WINDOW_MS, peopleWhoTouchedBefore, dropPeopleOnSeveralAddresses, guessesOnSeveralAddresses, TOUCH_LEAD_WINDOW_MS, TOUCH_TO_VISIT_WINDOW_MS, MAILING_IP_WINDOW_MS, resolveEmailRecipients, resolveMailingRecipients, type EmailRecipient, type MailingAnchor, type MailingClick } from '@/lib/marketing/email-attribution'
import { B2B_PORTAL_SECTIONS, CANDIDATE_PORTAL_SECTIONS, classifyVisitPage, isMutedVisitPageType, type VisitPageType } from '@/lib/admin/visit-page-type'
import { PREFETCH_OPEN_WINDOW_MS } from '@/lib/mailing/open-human'
import { scannerClickVisitSql } from '@/lib/marketing/scanner-click-visit'
import { inheritIdentityByIp } from '@/lib/admin/visitor-ip-identity'
import { segmentRangeSeries, type SegmentCountRow } from '@/lib/admin/visitor-segment-series'
import { sourceSegment, type SourceSegment } from '@/lib/admin/visitor-source-segment'
import { loadVisitorTypeCounts, visitorTypeSeries } from '@/lib/admin/visitor-day-types'
import { VisitorsSegmentChart, type SegmentChartLine } from '@/components/admin/VisitorsSegmentChart'
import { TrackedFilterLink, TrackedTypeForm } from '@/components/admin/VisitorFilterTracking'
import { USER_TYPE_SLUGS, VISITOR_USER_TYPES, userTypeFromCrm, userTypeFromLandingPath, userTypeSlug, type UserTypeBasis, type VisitorUserType } from '@/lib/admin/visitor-user-type'
import { allTimeDayCountFromFirstDay, byHourOfDayFromCounts, byWeekdayFromCounts, perDaySeriesFromCounts, perHourSeriesFromCounts } from '@/lib/admin/visitor-time-buckets'

export const maxDuration = 30

const CHART_WINDOW_DAYS = 30
// The visitor-type filter classifies this many recent visitors, then pages through the matches.
const TYPE_SCAN_LIMIT = 300
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
  // Why likelyRecipient was set when it was not an email visit: the address they gave, or another event from the same IP.
  likelyBasis: 'gave email' | 'same IP' | 'opened email' | 'email click' | null
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
  // Who they are: the CRM, then a signed-up account, then a guess from the page they landed on.
  userType: VisitorUserType
  userTypeBasis: UserTypeBasis
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

// Cloud networks (Google Cloud in Council Bluffs, Azure, AWS, Facebook's crawler) are email link scanners and automated browsers.
const notCloudSql = Prisma.sql`NOT (CASE WHEN "ip" ~ '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' THEN "ip"::inet <<= ANY(${DATACENTER_CIDRS}::text[]::inet[]) ELSE false END)`

// An email visit that lands within two minutes of the email being delivered is the mail scanner checking the link, not the person
// (the window that decides a human open, open-human.ts). Three cases, all fixed text with no user input:
//  1. a visit to the list email's unsubscribe link (its token is the start of the recipient's encoded address) inside that window;
//  2. the visit that follows it from the same address within five seconds (the report page the link redirects to);
//  3. a visit through a tracked outreach link (nc_e) inside two minutes of the link being made;
//  4. a page view within 30 seconds of a click Resend flagged as a bot on a link to that page, with no human click on it in that
//     window: the mail-security gateway loading the page it just clicked (Beth Moe, 2026-11-12: 41 bot clicks in 12 hours, and
//     a page view after each, from addresses that look like phones). 2,565 of 3,443 report views in 3 days fit this. Not when
//     that address made a human click in the day around it (scanner-click-visit.ts has the rule and its tests).
const PREFETCH_SECS = PREFETCH_OPEN_WINDOW_MS / 1000
const b64url = (expr: string) => `translate(rtrim(encode(convert_to(${expr},'UTF8'),'base64'),'='),'+/','-_')`
const unsubscribeToken = (v: string) => `substring(${v}."path" from '^/updates/unsubscribe/([A-Za-z0-9_-]+)')`
// True when visit `v` (a table alias) is an unsubscribe-link visit inside the delivery window of the recipient its token names.
const unsubscribePrefetch = (v: string) => `EXISTS (SELECT 1 FROM "MailingEditionRecipient" r WHERE r."deliveredAt" IS NOT NULL AND CASE
    WHEN ${v}."createdAt" BETWEEN r."deliveredAt" AND r."deliveredAt" + make_interval(secs => ${PREFETCH_SECS})
    THEN (left(${b64url('lower(r."email")')}, length(${unsubscribeToken(v)})) = ${unsubscribeToken(v)}
       OR left(${b64url(b64url('lower(r."email")'))}, length(${unsubscribeToken(v)})) = ${unsubscribeToken(v)})
    ELSE false END)`
const notEmailPrefetchSql = Prisma.raw(`NOT (
  ("path" LIKE '/updates/unsubscribe/%' AND ${unsubscribePrefetch('"HomepageVisitEvent"')})
  OR ("path" NOT LIKE '/updates/unsubscribe/%' AND "ip" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "HomepageVisitEvent" u WHERE u."ip" = "HomepageVisitEvent"."ip" AND u."path" LIKE '/updates/unsubscribe/%'
      AND u."createdAt" BETWEEN "HomepageVisitEvent"."createdAt" - make_interval(secs => 5) AND "HomepageVisitEvent"."createdAt" + make_interval(secs => 5)
      AND ${unsubscribePrefetch('u')}))
  OR ("path" LIKE '%nc_e=%' AND EXISTS (SELECT 1 FROM "CrmOutreachLink" l
    WHERE l."id" = substring("path" from 'nc_e=([A-Za-z0-9]+)') AND "HomepageVisitEvent"."createdAt" <= l."createdAt" + make_interval(secs => ${PREFETCH_SECS})))
  OR ${scannerClickVisitSql})`)

// IPv4 /24 blocks (as "a.b.c" prefixes) that scanners click from, one address at a time: the visit that follows is theirs too.
const notScannerBlockSql = (blocks: Set<string>): Prisma.Sql =>
  blocks.size === 0
    ? Prisma.empty
    : Prisma.sql` AND NOT (CASE WHEN "ip" ~ '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' THEN "ip"::inet <<= ANY(${Array.from(blocks).map((b) => `${b}.0/24`)}::text[]::inet[]) ELSE false END)`

// Visits from China with no signed-in account: a site for US white-collar job seekers. 2026-11: 181 addresses in 14 days, one
// Windows Chrome string, one page each, no referrer, never signed in. A visitor who has an account (candidateId) stays.
const notChinaScrapeSql = Prisma.sql`NOT ("country" = 'CN' AND "candidateId" IS NULL)`

function botFilterSql(showBots: boolean, scannerIps: Set<string>, scannerBlocks: Set<string> = new Set()): Prisma.Sql {
  if (showBots) return Prisma.sql`TRUE`
  const patterns = BOT_SIGNATURES.map((sig) => `%${sig}%`)
  const notBot = Prisma.sql`("userAgent" IS NULL OR NOT ("userAgent" ILIKE ANY(${patterns}))) AND ${notChinaScrapeSql} AND ${notCloudSql} AND ${notEmailPrefetchSql}${notScannerBlockSql(scannerBlocks)}`
  return scannerIps.size > 0 ? Prisma.sql`${notBot} AND ("ip" IS NULL OR NOT ("ip" = ANY(${Array.from(scannerIps)})))` : notBot
}

type LogEvent = Awaited<ReturnType<typeof prisma.homepageVisitEvent.findMany<{ include: { candidate: { select: { id: true; firstName: true; lastName: true; email: true } } } }>>>

type VisitorSort = 'clicks' | 'views'
type EmailFilter = 'yes' | 'no'
// Which kinds of identification to keep (any of them): came through or gave an email, a guessed email, a CRM match.
const MATCH_KINDS = ['email', 'likely', 'crm'] as const
type MatchKind = (typeof MATCH_KINDS)[number]
const MATCH_LABELS: Record<MatchKind, string> = { email: 'Email', likely: 'Likely', crm: 'CRM' }

// Newest first, through the same SQL filter as the counts and charts (a plain Prisma query cannot test a cloud-network block), so
// with Human only on, a scanner or cloud-network visit never appears in the list that the page count describes.
// One row per visit: events from the same IP with no gap over 30 minutes are one visit (a person clicking through pages, or a
// browser prefetching links), shown on its latest event with the visit's view and click counts. Reads the range only (30 days at most).
const VISIT_GAP_MINUTES = 30
// Grouping runs the full bot filter over every event in range, so it reads 7 days at most (30 days timed out the page on 2026-11-12).
const VISIT_GROUP_DAYS = 7
async function loadEventsNewest(botFilter: Prisma.Sql, start: Date, skip: number, take: number): Promise<{ events: LogEvent; total: number; visitTotals: Map<string, { views: number; clicks: number }> }> {
  const visits = Prisma.sql`
    WITH ev AS (
      SELECT "id", "createdAt", "ip", "eventType",
        CASE WHEN lag("createdAt") OVER (PARTITION BY COALESCE("ip", "id") ORDER BY "createdAt", "id") IS NULL
               OR "createdAt" - lag("createdAt") OVER (PARTITION BY COALESCE("ip", "id") ORDER BY "createdAt", "id") > make_interval(mins => ${Prisma.raw(String(VISIT_GAP_MINUTES))})
             THEN 1 ELSE 0 END AS "brk"
      FROM "HomepageVisitEvent" WHERE ${botFilter} AND "createdAt" >= ${start}
    ), s AS (
      SELECT *, sum("brk") OVER (PARTITION BY COALESCE("ip", "id") ORDER BY "createdAt", "id") AS "sid" FROM ev
    ), g AS (
      SELECT (array_agg("id" ORDER BY "createdAt" DESC, "id" DESC))[1] AS "id", max("createdAt") AS "last",
        count(*) FILTER (WHERE "eventType"::text = 'PAGE_VIEW') AS "views", count(*) FILTER (WHERE "eventType"::text <> 'PAGE_VIEW') AS "clicks"
      FROM s GROUP BY COALESCE("ip", "id"), "sid"
    )`
  // One query: the total rides along on every row (count over the whole grouped set, before OFFSET and LIMIT).
  const ids = await prisma.$queryRaw<{ id: string; views: bigint; clicks: bigint; total: bigint }[]>(
    Prisma.sql`${visits} SELECT "id", "views", "clicks", count(*) OVER () AS "total" FROM g ORDER BY "last" DESC, "id" DESC OFFSET ${skip} LIMIT ${take}`
  )
  const rows = await prisma.homepageVisitEvent.findMany({
    where: { id: { in: ids.map((r) => r.id) } },
    include: { candidate: { select: { id: true, firstName: true, lastName: true, email: true } } },
  })
  const order = new Map(ids.map((r, i) => [r.id, i] as const))
  return {
    events: rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)),
    total: Number(ids[0]?.total ?? 0),
    visitTotals: new Map(ids.map((r) => [r.id, { views: Number(r.views), clicks: Number(r.clicks) }] as const)),
  }
}

// One window query over the range's rows only. Sorted by clicks or views: one row per visitor (an IP; an event with no IP stands
// alone), that visitor's latest event. Not sorted: every event, newest first. The email filter keeps visitors we hold an email for
// (the IP signed in, came through an email link, or submitted a lead form or signed up from it) or only those we do not.
async function loadEventsByVisitor(
  botFilter: Prisma.Sql,
  start: Date,
  skip: number,
  take: number,
  metric: VisitorSort | null,
  email: EmailFilter | null,
  collapse: boolean = !!metric
): Promise<{ events: LogEvent; total: number }> {
  const orderBy = metric === 'views' ? Prisma.sql`"views" DESC, "clicks" DESC, "createdAt" DESC` : metric === 'clicks' ? Prisma.sql`"clicks" DESC, "views" DESC, "createdAt" DESC` : Prisma.sql`"createdAt" DESC`
  const rowFilter = Prisma.sql`${collapse ? Prisma.sql`"rn" = 1` : Prisma.sql`TRUE`} AND ${email === 'yes' ? Prisma.sql`"ident"` : email === 'no' ? Prisma.sql`NOT "ident"` : Prisma.sql`TRUE`}`
  const inner = Prisma.sql`
    SELECT "id", "createdAt",
      count(*) FILTER (WHERE "eventType"::text = 'LINK_CLICK') OVER (PARTITION BY COALESCE("ip", "id")) AS "clicks",
      count(*) FILTER (WHERE "eventType"::text = 'PAGE_VIEW') OVER (PARTITION BY COALESCE("ip", "id")) AS "views",
      bool_or("signal") OVER (PARTITION BY COALESCE("ip", "id")) AS "ident",
      row_number() OVER (PARTITION BY COALESCE("ip", "id") ORDER BY "createdAt" DESC) AS "rn"
    FROM (
      SELECT "id", "createdAt", "ip", "eventType",
        ("candidateId" IS NOT NULL OR "path" LIKE '%nc_e=%' OR "path" LIKE '/updates/unsubscribe/%'
          OR ("ip" IS NOT NULL AND ("ip" IN (SELECT "ip" FROM "HomepageLead" WHERE "ip" IS NOT NULL)
            OR "ip" IN (SELECT "signupIp" FROM "CandidateProfile" WHERE "signupIp" IS NOT NULL)))) AS "signal"
      FROM "HomepageVisitEvent"
      WHERE ${botFilter} AND "createdAt" >= ${start}
    ) e`
  const [ids, totalRows] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM (${inner}) t
      WHERE ${rowFilter}
      ORDER BY ${orderBy}
      OFFSET ${skip} LIMIT ${take}`),
    prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`SELECT count(*) AS "n" FROM (${inner}) t WHERE ${rowFilter}`),
  ])
  const rows = await prisma.homepageVisitEvent.findMany({
    where: { id: { in: ids.map((r) => r.id) } },
    include: { candidate: { select: { id: true, firstName: true, lastName: true, email: true } } },
  })
  const order = new Map(ids.map((r, i) => [r.id, i] as const))
  return { events: rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)), total: Number(totalRows[0]?.n ?? 0) }
}

// Day / week and newest / most clicks: adjacent buttons (links), the current choice marked.
function LogControls({ range, sort, showBots, email, type, unique, match }: { range: LogRange; sort: VisitorSort | null; showBots: boolean; email: EmailFilter | null; type: string | null; unique: boolean; match: MatchKind[] }) {
  const href = (r: LogRange, by: VisitorSort | null, bots: boolean = showBots, em: EmailFilter | null = email, uq: boolean = unique, mt: MatchKind[] = match) => {
    const q = new URLSearchParams()
    if (bots) q.set('bots', 'show')
    if (r !== 'all') q.set('range', r)
    if (by) q.set('sort', by)
    if (em) q.set('email', em)
    if (type) q.set('type', type)
    if (uq) q.set('unique', '1')
    if (mt.length > 0) q.set('match', mt.join(','))
    const qs = q.toString()
    return `/support/admin/visitors/activity${qs ? `?${qs}` : ''}`
  }
  const context = { range, sort, bots: showBots, email, type, unique, match: match.length > 0 ? match.join(',') : null }
  const button = (active: boolean) =>
    `rounded-md border px-3 py-1.5 text-sm ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`
  const ranges: { key: LogRange; label: string }[] = [
    { key: 'day', label: 'Last 24 hours' },
    { key: 'week', label: 'Last 7 days' },
    { key: 'all', label: 'All time' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <nav aria-label="Traffic" className="flex gap-2">
        {([{ show: false, label: 'Human only' }, { show: true, label: 'All traffic, bots and scanners included' }] as const).map((t) => (
          <TrackedFilterLink filter="traffic" value={t.show ? 'all_traffic' : 'human_only'} context={context} key={t.label} href={href(range, sort, t.show, email)} aria-current={showBots === t.show ? 'true' : undefined} className={button(showBots === t.show)}>
            {t.label}
          </TrackedFilterLink>
        ))}
      </nav>
      <nav aria-label="Time range" className="flex gap-2">
        {ranges.map((r) => (
          <TrackedFilterLink filter="range" value={r.key} context={context} key={r.key} href={href(r.key, sort, showBots, email)} aria-current={range === r.key ? 'true' : undefined} className={button(range === r.key)}>
            {r.label}
          </TrackedFilterLink>
        ))}
      </nav>
      <nav aria-label="Sort order" className="flex gap-2">
        <TrackedFilterLink filter="sort" value="newest" context={context} href={href(range, null, showBots, email)} aria-current={!sort ? 'true' : undefined} className={button(!sort)}>
          Newest first
        </TrackedFilterLink>
        <TrackedFilterLink filter="sort" value="clicks" context={context} href={href(range, 'clicks', showBots, email)} aria-current={sort === 'clicks' ? 'true' : undefined} className={button(sort === 'clicks')}>
          Most clicks first
        </TrackedFilterLink>
        <TrackedFilterLink filter="sort" value="views" context={context} href={href(range, 'views', showBots, email)} aria-current={sort === 'views' ? 'true' : undefined} className={button(sort === 'views')}>
          Most views first
        </TrackedFilterLink>
      </nav>
      <nav aria-label="Visitors" className="flex gap-2">
        {([{ on: false, label: 'Every visit' }, { on: true, label: 'Unique only' }] as const).map((o) => (
          <TrackedFilterLink filter="unique" value={o.on ? 'unique_only' : 'every_visit'} context={context} key={o.label} href={href(range, sort, showBots, email, o.on)} aria-current={unique === o.on ? 'true' : undefined} className={button(unique === o.on)}>
            {o.label}
          </TrackedFilterLink>
        ))}
      </nav>
      <nav aria-label="Email and CRM" className="flex gap-2">
        {([{ key: null, label: 'Email and CRM: both' }, { key: 'yes', label: 'Email or CRM: yes' }, { key: 'no', label: 'Email or CRM: no' }] as const).map((o) => (
          <TrackedFilterLink filter="email_crm" value={o.key ?? 'both'} context={context} key={o.label} href={href(range, sort, showBots, o.key)} aria-current={email === o.key ? 'true' : undefined} className={button(email === o.key)}>
            {o.label}
          </TrackedFilterLink>
        ))}
      </nav>
      <nav aria-label="Include visitors identified by" className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Include</span>
        {MATCH_KINDS.map((k) => {
          const on = match.includes(k)
          const next = on ? match.filter((x) => x !== k) : MATCH_KINDS.filter((x) => x === k || match.includes(x))
          return (
            <TrackedFilterLink filter="match" value={`${k}_${on ? 'off' : 'on'}`} context={context} key={k} href={href(range, sort, showBots, email, unique, next)} aria-current={on ? 'true' : undefined} className={button(on)}>
              {MATCH_LABELS[k]}
            </TrackedFilterLink>
          )
        })}
      </nav>
      <TrackedTypeForm context={context} method="get" action="/support/admin/visitors/activity" className="flex items-center gap-2">
        {showBots && <input type="hidden" name="bots" value="show" />}
        {range !== 'all' && <input type="hidden" name="range" value={range} />}
        {sort && <input type="hidden" name="sort" value={sort} />}
        {email && <input type="hidden" name="email" value={email} />}
        {unique && <input type="hidden" name="unique" value="1" />}
        {match.length > 0 && <input type="hidden" name="match" value={match.join(',')} />}
        <label htmlFor="visitor-type" className="text-sm text-muted-foreground">Visitor type</label>
        <select id="visitor-type" name="type" defaultValue={type ?? ''} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm">
          <option value="">All types</option>
          <option value="not-candidate">Everyone except candidates</option>
          {VISITOR_USER_TYPES.map((t) => (
            <option key={t} value={userTypeSlug(t)}>{t}</option>
          ))}
        </select>
        <button type="submit" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">Show this type</button>
      </TrackedTypeForm>
      {type && <p className="text-xs text-muted-foreground">The type filter looks at the {TYPE_SCAN_LIMIT} most recent visitors in the last 30 days (or the range chosen, if shorter), each counted once.</p>}
      {type === 'not-candidate' && <p className="text-xs text-muted-foreground">Everyone except candidates leaves out visitors we cannot place (Unknown) as well as candidates.</p>}
      {match.length > 0 && <p className="text-xs text-muted-foreground">Include shows visitors with any of the chosen kinds. Email: came through one of our emails or gave an address. Likely: we guess who they are from an email, an address they gave, or the same IP. CRM: matched to a CRM person. It looks at the {TYPE_SCAN_LIMIT} most recent visitors in the last 30 days (or the range chosen, if shorter), each counted once.</p>}
      {unique && <p className="text-xs text-muted-foreground">Unique only shows each visitor (IP address) once, on their latest visit.</p>}
      {(sort || email || unique) && range === 'all' && <p className="text-xs text-muted-foreground">Most clicks, most views, unique only and the email filter look at the last 30 days, the longest span they count over.{sort ? ' Each visitor (IP address) appears once.' : ''}</p>}
      {!sort && !email && !unique && match.length === 0 && !type && range === 'all' && <p className="text-xs text-muted-foreground">Every visit lists visits from the last {VISIT_GROUP_DAYS} days, each visit grouped from one address.</p>}
      {sort && range !== 'all' &&<p className="text-xs text-muted-foreground">Each visitor (IP address) appears once, on their latest visit.</p>}
      {email && <p className="text-xs text-muted-foreground">Yes means we hold an email for the visitor&apos;s IP address: an account, an email link they came through, or a lead form or sign-up from it. No means none of those.</p>}
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
  const email: EmailFilter | null = rawParams.email === 'yes' || rawParams.email === 'no' ? rawParams.email : null
  const typeFilter: VisitorUserType | null = (rawParams.type && USER_TYPE_SLUGS[rawParams.type]) || null
  const notCandidate = rawParams.type === 'not-candidate'
  const typeActive = !!typeFilter || notCandidate
  const typeParam = typeFilter ? userTypeSlug(typeFilter) : notCandidate ? 'not-candidate' : null
  const unique = rawParams.unique === '1'
  const match: MatchKind[] = MATCH_KINDS.filter((k) => (rawParams.match ?? '').split(',').includes(k))
  const scanActive = typeActive || match.length > 0
  // Sorted, unique and the type or match filters show one row per visitor (their latest event); otherwise every event is a row.
  const oneRowPerVisitor = !!sort || unique || scanActive
  // Counting clicks or views per visitor is a window over the rows in range, so it never runs over the whole table: all time reads 30 days.
  const logDays = logRange === 'day' ? 1 : logRange === 'week' ? 7 : 30
  const logStart = new Date(now().getTime() - logDays * DAY_MS)
  // Mail scanners are hidden with the bots: they open every link for every recipient, and are not people.
  // Also hidden: any address a list-email click flagged as a bot came from, and the /24 blocks scanners click from. Their page
  // visits otherwise pass as human (an iPhone or Chrome browser string from an address no cloud list knows).
  const [mailScannerIps, botClickNetworks] = await Promise.all([
    loadScannerIps().catch(() => new Set<string>()),
    loadBotClickNetworks().catch(() => ({ ips: new Set<string>(), blocks: new Set<string>() })),
  ])
  const scannerIps = new Set([...mailScannerIps, ...botClickNetworks.ips])
  const scannerBlocks = botClickNetworks.blocks
  const etDay = Prisma.sql`to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York', 'YYYY-MM-DD')`
  const etHour = Prisma.sql`to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York', 'YYYY-MM-DD HH24')`

  const current = now()
  const botPatterns = BOT_SIGNATURES.map((sig) => `%${sig}%`)
  const botFilter = botFilterSql(showBots, scannerIps, scannerBlocks)
  const since = (days: number) => new Date(current.getTime() - days * DAY_MS)
  const rangeSql = logStart ? Prisma.sql`"createdAt" >= ${logStart}` : Prisma.sql`TRUE`

  // The charts follow the Human only / All traffic switch. Human only: a known user agent that is not a bot, not a cloud network
  // (email scanners, crawlers) and not a mail-scanner IP. All traffic: every page view.
  const humanPageView = showBots
    ? Prisma.sql`"eventType" = 'PAGE_VIEW'`
    : Prisma.sql`"eventType" = 'PAGE_VIEW' AND "userAgent" IS NOT NULL AND NOT ("userAgent" ILIKE ANY(${botPatterns})) AND ${notChinaScrapeSql} AND ${notCloudSql} AND ${notEmailPrefetchSql}${notScannerBlockSql(scannerBlocks)}${
        scannerIps.size > 0 ? Prisma.sql` AND ("ip" IS NULL OR NOT ("ip" = ANY(${Array.from(scannerIps)})))` : Prisma.empty
      }`
  const viewsLabel = showBots ? 'Page views, all traffic' : 'Human page views'
  type BucketRow = { key: string; views: bigint; visitors: bigint }
  const [loaded, dayRows, hourRows, totalsRows] = await Promise.all([
    sort || email || scanActive || unique
      ? loadEventsByVisitor(botFilter, logStart, scanActive ? 0 : params.skip, scanActive ? TYPE_SCAN_LIMIT : params.take, sort, email, !!sort || scanActive || unique)
      : loadEventsNewest(botFilter, new Date(Math.max(logStart.getTime(), now().getTime() - VISIT_GROUP_DAYS * DAY_MS)), params.skip, params.take),
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

  const events = loaded.events
  const visitTotals = ('visitTotals' in loaded ? loaded.visitTotals : null) as Map<string, { views: number; clicks: number }> | null
  // Email visits inside two minutes of delivery (the unsubscribe-link visit, the report visit that follows it, an outreach link),
  // marked on the rows shown. In Human only mode they are already out of the list; in All traffic mode this labels them.
  const prefetchIds = new Set(
    events.length === 0
      ? []
      : (await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "HomepageVisitEvent" WHERE "id" = ANY(${events.map((x) => x.id)}) AND NOT ${notEmailPrefetchSql}`)).map((x) => x.id)
  )
  const t = totalsRows[0]
  const totals: Record<TrafficRange, RangeTotals> = {
    day: { events: Number(t?.e1 ?? 0), visitors: Number(t?.v1 ?? 0) },
    '7d': { events: Number(t?.e7 ?? 0), visitors: Number(t?.v7 ?? 0) },
    '30d': { events: Number(t?.e30 ?? 0), visitors: Number(t?.v30 ?? 0) },
    all: { events: Number(t?.eall ?? 0), visitors: Number(t?.vall ?? 0) },
  }
  // Same count the log is paginated by (the bot rule is the same SQL filter).
  const total = loaded.total
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

  // Visitors by type: one line per type from the stored daily snapshot (VisitorDayType). A missing table (before the migration) shows an empty chart.
  const typeColors = ['var(--color-brand)', 'var(--color-orange)', 'var(--color-success)', 'var(--color-navy)', 'var(--color-light-blue)', 'var(--color-accent-employer)', 'var(--color-accent-coach)', 'var(--color-error)', 'var(--color-warning)', 'var(--color-accent-recruiter)', 'var(--color-gray)']
  const typeLines: SegmentChartLine[] = visitorTypeSeries(await loadVisitorTypeCounts().catch(() => []), current, allTimeDays).map((t, i) => ({
    label: t.userType,
    color: typeColors[i % typeColors.length],
    data: { day: t.series['7d'], '7d': t.series['7d'], '30d': t.series['30d'], all: t.series.all },
  }))

  const toDaysRows = (rows: { key: string; count: number }[]) => rows.map((d) => ({ dateKey: d.key, count: d.count }))
  // Emails captured per day: every form on the public site plus new registrations.
  // Seeded sample profiles and profiles with no email are not captures (332 were bulk-created on Oct 15).
  const [captured, registrationRows, applyClickRows, nativeApplicationRows, paidFunnel] = await Promise.all([
    loadCapturedEmailsForDays(CHART_WINDOW_DAYS),
    prisma.candidateProfile.findMany({
      where: { createdAt: { gte: since(CHART_WINDOW_DAYS) }, isSampleData: false, email: { not: null } },
      select: { createdAt: true },
    }),
    prisma.homepageVisitEvent.findMany({
      where: { eventType: 'LINK_CLICK', createdAt: { gte: since(CHART_WINDOW_DAYS) }, href: { not: null }, path: { startsWith: '/jobs/' } },
      select: { createdAt: true, userAgent: true, href: true, path: true, ip: true },
    }),
    prisma.nativeJobApplication.findMany({ where: { createdAt: { gte: since(CHART_WINDOW_DAYS) } }, select: { createdAt: true } }),
    loadPaidFunnel(CHART_WINDOW_DAYS),
  ])
  const paidSum = (f: 'visitors' | 'emails' | 'accounts') => paidFunnel.reduce((t, r) => t + r[f], 0)
  const paidTotal = {
    channel: 'all' as const,
    visitors: paidSum('visitors'),
    emails: paidSum('emails'),
    accounts: paidSum('accounts'),
    emailRate: paidSum('visitors') ? paidSum('emails') / paidSum('visitors') : null,
    accountRate: paidSum('visitors') ? paidSum('accounts') / paidSum('visitors') : null,
  }
  // Only clicks tied to a job page: clicks recorded before path tracking (to Oct 27) had no page, so they cannot be told from footer or news links.
  const humanApplyClicks = applyClickRows.filter(
    (e) => (showBots || (classifyUserAgent(e.userAgent) === 'human' && !isDatacenterIp(e.ip) && !(e.ip && scannerIps.has(e.ip)))) && isApplyClick('LINK_CLICK', e.href, e.path)
  )
  const applicationSeries = [
    { label: showBots ? 'Apply clicks (all traffic)' : 'Apply clicks (human)', days: toDaysRows(countsPerDay(humanApplyClicks.map((e) => e.createdAt), current, CHART_WINDOW_DAYS)), color: 'var(--color-success)' },
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
    { label: viewsLabel, color: colors.views, buckets: byWeekdayFromCounts(dayViews, current, CHART_WINDOW_DAYS) },
    { label: 'Unique visitors', color: colors.visitors, buckets: byWeekdayFromCounts(dayVisitors, current, CHART_WINDOW_DAYS) },
  ]
  const hourSeries = (dayType: 'weekday' | 'weekend') => [
    { label: viewsLabel, color: colors.views, buckets: byHourOfDayFromCounts(hourViews, current, CHART_WINDOW_DAYS, dayType) },
    { label: 'Unique visitors', color: colors.visitors, buckets: byHourOfDayFromCounts(hourVisitors, current, CHART_WINDOW_DAYS, dayType) },
  ]

  // One lookup per unique IP on this page, not per row — same convention as
  // the daily digest email (send-homepage-visitor-digest.ts) — comfortably
  // stays under ip-api.com's free-tier rate limit even on a full 50-row page.
  const uniqueIps = Array.from(new Set(events.map((e) => e.ip).filter((ip): ip is string => !!ip)))

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
  // Visits through a link in a list email carry the recipient's id (nc_m): the person, certain.
  const mailingById = await resolveMailingRecipientIds(events.map((e) => extractMailingRecipientId(e.path)).filter((id): id is string => !!id))
  const taggedPerson = (path: string | null) => {
    const id = extractMailingRecipientId(path)
    return id ? (mailingById.get(id) ?? null) : null
  }

  // Clicks Resend recorded on list-email links, from these IPs in the ten minutes before the oldest visit shown: the person who
  // clicked and the visit that follows from the same address. A missing table (before the migration) just means no clicks.
  const clickRows =
    uniqueIps.length > 0
      ? await prisma.mailingClickEvent
          .findMany({
            where: { bot: false, ip: { in: uniqueIps.filter((ip) => !scannerIps.has(ip) && !isDatacenterIp(ip)) }, clickedAt: { gte: new Date(oldestShown.getTime() - CLICK_TO_VISIT_WINDOW_MS), lte: new Date(newest.getTime() + CLICK_LEAD_WINDOW_MS) } },
            select: { ip: true, clickedAt: true, recipient: { select: { personId: true } } },
          })
          .catch(() => [])
      : []
  const mailingClicks: MailingClick[] = clickRows.flatMap((c) => (c.recipient.personId ? [{ ip: c.ip, at: c.clickedAt, personId: c.recipient.personId }] : []))
  const clickPeople = await loadRecipientsByPersonId(mailingClicks.map((c) => c.personId))

  // Human opens and clicks of list emails just before the visits shown, any address (mail proxies hide the reader's own).
  // Reads only the human ones in a window around the page: a dozen or so a day. A missing table just means none.
  const touchFrom = new Date(oldestShown.getTime() - TOUCH_TO_VISIT_WINDOW_MS)
  const touchTo = new Date(newest.getTime() + TOUCH_LEAD_WINDOW_MS)
  const [openTouchRows, clickTouchRows, nearClickRows] = await Promise.all([
    prisma.mailingOpenEvent.findMany({ where: { bot: false, openedAt: { gte: touchFrom, lte: touchTo } }, select: { openedAt: true, recipient: { select: { personId: true } } }, take: 1000 }).catch(() => []),
    prisma.mailingClickEvent.findMany({ where: { bot: false, clickedAt: { gte: touchFrom, lte: touchTo } }, select: { clickedAt: true, link: true, recipient: { select: { personId: true } } }, take: 1000 }).catch(() => []),
    // Every click, scanner or person, from any address, seconds around the visits shown: the tracked link that sent the visit.
    prisma.mailingClickEvent.findMany({ where: { clickedAt: { gte: new Date(oldestShown.getTime() - NEAR_CLICK_WINDOW_MS), lte: new Date(newest.getTime() + NEAR_CLICK_WINDOW_MS) } }, select: { clickedAt: true, link: true, recipient: { select: { personId: true } } }, take: 2000 }).catch(() => []),
  ])
  const nearClicks = nearClickRows.flatMap((c) => (c.recipient.personId ? [{ at: c.clickedAt, personId: c.recipient.personId, link: c.link }] : []))
  const touches = [
    ...openTouchRows.flatMap((o) => (o.recipient.personId ? [{ at: o.openedAt, personId: o.recipient.personId }] : [])),
    ...clickTouchRows.flatMap((c) => (c.recipient.personId ? [{ at: c.clickedAt, personId: c.recipient.personId }] : [])),
  ]

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

  const baseRows: Row[] = events.map((e) => ({
    id: e.id,
    createdAt: e.createdAt,
    ip: e.ip,
    eventType: e.eventType,
    path: e.path,
    href: e.href,
    referrer: e.referrer,
    userAgent: e.userAgent,
    location: null,
    candidate: e.candidate,
    inferredCandidate: !e.candidate && e.ip ? (inferredCandidateByIp.get(e.ip) ?? null) : null,
    source: e.eventType === 'PAGE_VIEW' ? classifyTrafficSource(e.path, e.referrer) : '—',
    scanner: (!!e.ip && (scannerIps.has(e.ip) || isDatacenterIp(e.ip) || scannerBlocks.has(e.ip.split('.').slice(0, 3).join('.')))) || prefetchIds.has(e.id),
    recipient: (() => {
      if (e.ip && scannerIps.has(e.ip)) return null
      const id = extractEmailLinkId(e.path)
      if (id) return recipientByLink.get(id) ?? null
      const tagged = taggedPerson(e.path)
      if (tagged) return tagged
      const token = extractUnsubscribeToken(e.path)
      return token ? (mailingByToken.get(token) ?? null) : null
    })(),
    likelyRecipient: (() => {
      if (e.ip && scannerIps.has(e.ip)) return null
      if (!extractEmailLinkId(e.path) && !extractUnsubscribeToken(e.path) && !taggedPerson(e.path)) {
        const clicked = inferPersonByClickIp(e, mailingClicks)
        if (clicked && clickPeople.has(clicked)) return clickPeople.get(clicked) ?? null
      }
      const mailToken = extractEmailLinkId(e.path) || extractUnsubscribeToken(e.path) || taggedPerson(e.path) ? null : inferMailingTokenByIp(e, mailingAnchors, (t) => mailingByToken.get(t)?.personId)
      if (mailToken) return mailingByToken.get(mailToken) ?? null
      if (classifyUserAgent(e.userAgent) !== 'human' || isDatacenterIp(e.ip)) return null
      const id = inferEmailLinkByIp(e, ipAnchors, (linkId) => recipientByLink.get(linkId)?.personId)
      return id ? (recipientByLink.get(id) ?? null) : null
    })(),
    likelyBasis: null,
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
      const recipient = e.ip && scannerIps.has(e.ip) ? null : link ? recipientByLink.get(link) : taggedPerson(e.path) ?? (token ? mailingByToken.get(token) : null)
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
    userType: 'Unknown',
    userTypeBasis: null,
  }))

  // Carry a name to the rest of a visitor's events. Each rule above looks in a short window around one event; once any event
  // of an IP is identified (an email link, a recorded click, an account, an address they gave) the other events from that IP
  // are the same person, unless a second person shows up on the IP.
  const shareable = (r: Row) => !r.scanner && r.mailRecipients < 3 && classifyUserAgent(r.userAgent) === 'human' && !isDatacenterIp(r.ip)
  const ownIdentity = (r: Row): string | null => {
    if (r.recipient) return `crm:${r.recipient.personId}`
    const account = r.candidate ?? r.inferredCandidate
    if (account) return `candidate:${account.id}`
    if (r.likelyRecipient) return `crm:${r.likelyRecipient.personId}`
    if (r.crmPeople.length === 1) return `crm:${r.crmPeople[0].id}`
    return null
  }
  const inherited = inheritIdentityByIp(baseRows.map((r) => ({ id: r.id, ip: r.ip, at: r.createdAt, identity: ownIdentity(r), excluded: !shareable(r) })))
  // An unnamed row that gave an address already in the CRM is that person; one more lookup for the people not loaded above.
  const needsName = (r: Row) => !r.recipient && !r.likelyRecipient && !r.candidate && !r.inferredCandidate
  const personIdsToLoad = new Set<string>()
  // Visits nobody else names: the people who opened or clicked a list email in the minutes before (at most three; more is a guess about nothing).
  const touchedByRow = new Map<string, string[]>()
  const clickMatched = new Set<string>()
  for (const r of baseRows) {
    if (!needsName(r) || !shareable(r)) continue
    const key = r.crmPeople.length === 1 ? `crm:${r.crmPeople[0].id}` : inherited.get(r.id)
    if (key?.startsWith('crm:')) personIdsToLoad.add(key.slice(4))
    if (!key && r.crmPeople.length === 0 && r.candidates.length === 0 && r.eventType === 'PAGE_VIEW') {
      const byClick = peopleByNearClick(r, nearClicks)
      const people = byClick.length > 0 ? byClick : peopleWhoTouchedBefore(r.createdAt, touches)
      if (people.length >= 1 && people.length <= 3) {
        touchedByRow.set(r.id, people)
        if (byClick.length > 0) clickMatched.add(r.id)
        people.forEach((id) => personIdsToLoad.add(id))
      }
    }
  }
  // A time-only match that would put one person on several addresses is a mail scanner burst: name nobody.
  const ipByRow = new Map(baseRows.map((r) => [r.id, r.ip] as const))
  const timeMatched = dropPeopleOnSeveralAddresses(new Map(Array.from(touchedByRow).filter(([id]) => !clickMatched.has(id))), (id) => ipByRow.get(id) ?? null)
  for (const id of Array.from(touchedByRow.keys())) {
    if (clickMatched.has(id)) continue
    const kept = timeMatched.get(id)
    if (kept) touchedByRow.set(id, kept)
    else touchedByRow.delete(id)
  }
  const loadedPeople = await loadRecipientsByPersonId(Array.from(personIdsToLoad))
  const accountsByKey = new Map<string, NonNullable<Row['candidate']>>()
  for (const r of baseRows) {
    const account = r.candidate ?? r.inferredCandidate
    if (account) accountsByKey.set(`candidate:${account.id}`, account)
  }
  const namedRows: Row[] = baseRows.map((r) => {
    if (!needsName(r) || !shareable(r)) return r
    if (r.crmPeople.length === 1) {
      const person = loadedPeople.get(r.crmPeople[0].id)
      return person ? { ...r, likelyRecipient: person, likelyBasis: 'gave email' } : r
    }
    const key = inherited.get(r.id)
    if (!key) {
      const touched = (touchedByRow.get(r.id) ?? []).flatMap((id) => loadedPeople.get(id) ?? [])
      if (touched.length === 1) return { ...r, likelyRecipient: touched[0], likelyBasis: clickMatched.has(r.id) ? 'email click' : 'opened email' }
      if (touched.length > 1) return { ...r, candidates: touched }
      return r
    }
    if (key.startsWith('candidate:')) return { ...r, inferredCandidate: accountsByKey.get(key) ?? null }
    const person = loadedPeople.get(key.slice(4))
    return person ? { ...r, likelyRecipient: person, likelyBasis: 'same IP' } : r
  })
  // Whatever rule guessed it: one person on several addresses within minutes is a mail gateway, so name nobody.
  // A name that rests on a tracked link followed seconds before the visit (basis 'email click') is not a guess about who sat
  // behind an address: it is the recipient whose email that link was in, and a gateway opening it from several addresses is
  // expected. Those keep the name (the tooltip says it is their email, probably not them reading it).
  const gateway = guessesOnSeveralAddresses(namedRows.flatMap((r) => (!r.recipient && r.likelyRecipient && r.likelyBasis !== 'email click' ? [{ id: r.id, personId: r.likelyRecipient.personId, ip: r.ip, at: r.createdAt }] : [])))
  const rows: Row[] = namedRows.map((r) => (gateway.has(r.id) ? { ...r, likelyRecipient: null, likelyBasis: null } : r))

  // Visitor type. The CRM person's roles, then the type of the organization they work at; failing that a signed-up account is a
  // candidate; failing that a guess from the first page of the visit (last 30 days).
  const typePersonIds = Array.from(new Set(rows.flatMap((r) => [r.recipient?.personId, r.likelyRecipient?.personId, ...r.crmPeople.map((p) => p.id)].filter((x): x is string => !!x))))
  const typePeople =
    typePersonIds.length > 0
      ? await prisma.crmPerson.findMany({
          where: { id: { in: typePersonIds } },
          select: { id: true, roles: true, affiliations: { where: { isCurrent: true }, select: { org: { select: { orgTypes: true } } } } },
        })
      : []
  const crmTypeByPerson = new Map(typePeople.map((p) => [p.id, userTypeFromCrm(p.roles.map(String), p.affiliations.flatMap((a) => a.org.orgTypes.map(String)))] as const))
  const landingRows =
    uniqueIps.length > 0
      ? await prisma.$queryRaw<{ ip: string; path: string | null }[]>(Prisma.sql`
          SELECT DISTINCT ON ("ip") "ip", "path" FROM "HomepageVisitEvent"
          WHERE "ip" = ANY(${uniqueIps}) AND "eventType"::text = 'PAGE_VIEW' AND "createdAt" >= ${since(30)}
          ORDER BY "ip", "createdAt" ASC`)
      : []
  const landingByIp = new Map(landingRows.map((r) => [r.ip, r.path] as const))
  const typedRows: Row[] = rows.map((r) => {
    if (r.scanner) return r
    const personId = r.recipient?.personId ?? r.likelyRecipient?.personId ?? r.crmPeople[0]?.id
    const crmType = personId ? crmTypeByPerson.get(personId) : undefined
    if (crmType) return { ...r, userType: crmType, userTypeBasis: 'CRM' }
    if (r.candidate ?? r.inferredCandidate) return { ...r, userType: 'Candidate', userTypeBasis: 'account' }
    const guess = userTypeFromLandingPath((r.ip ? landingByIp.get(r.ip) : null) ?? r.path)
    return guess ? { ...r, userType: guess, userTypeBasis: 'landing page' } : r
  })

  // With a type chosen, the scan above covered the most recent visitors; page through the ones that match.
  const byType = typeFilter ? typedRows.filter((r) => r.userType === typeFilter) : notCandidate ? typedRows.filter((r) => r.userType !== 'Candidate' && r.userType !== 'Unknown') : typedRows
  // Same three kinds the Email and CRM column shows: a row stays when it has any chosen kind.
  const hasKind = (r: Row, k: MatchKind) => (k === 'email' ? !!r.recipient || r.givenEmails.length > 0 : k === 'likely' ? !r.recipient && !!r.likelyRecipient : r.crmPeople.length > 0)
  const matching = match.length > 0 ? byType.filter((r) => match.some((k) => hasKind(r, k))) : byType
  const shown = scanActive ? matching.slice(params.skip, params.skip + params.take) : matching
  // One lookup per unique IP on the page shown, not per row scanned (ip-api.com's free tier allows about 45 a minute).
  const shownIps = Array.from(new Set(shown.map((r) => r.ip).filter((ip): ip is string => !!ip)))
  const locationByIp = new Map(await Promise.all(shownIps.map(async (ip) => [ip, formatIpLocation(await lookupIpLocation(ip))] as const)))
  const result = paginatedResult(shown.map((r) => ({ ...r, location: r.ip ? (locationByIp.get(r.ip) ?? null) : null })), scanActive ? matching.length : total, params)

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
              title={isDatacenterIp(r.ip) ? 'This address belongs to a cloud network (Google Cloud, Azure, AWS). Email link scanners and automated browsers run there; it is not a person visiting.' : r.mailRecipients < 3 && !scannerIps.has(r.ip ?? '') ? 'This visit came within two minutes of the email being sent, which is a mail scanner checking the link, not a person.' : `This address opened the links in emails to ${r.mailRecipients} different people. It is a mail-security scanner checking their messages, not a person visiting.`}
            >
              📧 Mail scanner or cloud bot
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
                  title={
                    certain
                      ? 'The visit came through a link in an email we sent them.'
                      : r.likelyBasis === 'email click'
                        ? 'A link in an email we sent them was followed within seconds of this visit, from a different address (how mail security tools and some mail apps open links). Matched by time and page. Their email, probably not them reading it.'
                      : r.likelyBasis === 'opened email'
                        ? 'They opened or clicked our email in the 15 minutes before this visit, and nobody else did. Matched by time, not by address (mail apps hide the reader\'s address). A guess, not a certain match.'
                      : r.likelyBasis === 'gave email'
                        ? 'This visitor gave an email address that belongs to them in the CRM. The visit is from the same IP address. A strong guess, not a certain match.'
                        : 'Same IP address as another visit that named them, and no other person was seen on that address. A strong guess, not a certain match.'
                  }
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
    {
      header: 'Visitor type',
      render: (r) =>
        r.userType === 'Unknown' ? (
          <span className="text-muted-foreground">Unknown</span>
        ) : (
          <span title={r.userTypeBasis === 'CRM' ? 'From their CRM record: roles, then the type of their organization.' : r.userTypeBasis === 'account' ? 'They have a NextChapter account.' : 'A guess from the first page they landed on.'}>
            {r.userType}
            {r.userTypeBasis === 'landing page' && <span className="text-muted-foreground"> (guess)</span>}
          </span>
        ),
    },
    { header: 'Location', render: (r) => r.location ?? '—' },
    {
      // One row per visitor (sorted, unique or filtered): that visitor's totals. Every visit: the views and clicks of that one visit.
      header: oneRowPerVisitor ? 'Visitor totals' : 'This visit',
      cellClassName: 'tabular-nums',
      render: (r) =>
        !oneRowPerVisitor ? (
          <span title={`One visit: events from this address with no gap over ${VISIT_GAP_MINUTES} minutes. Different addresses are counted as different visitors, even when one person's phone or VPN switches address.`}>
            {(visitTotals?.get(r.id)?.views ?? 0)} <span className="text-muted-foreground">{visitTotals?.get(r.id)?.views === 1 ? 'view' : 'views'}</span>
            {(visitTotals?.get(r.id)?.clicks ?? 0) > 0 && <> · {visitTotals?.get(r.id)?.clicks} <span className="text-muted-foreground">{visitTotals?.get(r.id)?.clicks === 1 ? 'click' : 'clicks'}</span></>}
          </span>
        ) : !r.ip ? (
          '—'
        ) : r.scanner || r.mailRecipients >= 3 ? (
          <span
            className="text-muted-foreground"
            title={`This IP address opened the links in emails to ${r.mailRecipients} different people (${r.views} views, ${r.clicks} clicks in all). It is a mail scanner shared by many recipients, so its totals do not describe one person.`}
          >
            {isDatacenterIp(r.ip) ? 'Cloud network' : r.scanner && r.mailRecipients < 3 ? 'Sent seconds earlier' : `${r.scanner ? 'Mail scanner' : 'Shared IP'} · ${r.mailRecipients} people`}
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
            {fromEmail && (r.recipient || r.givenEmails.length === 0) && (
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
            {r.crmPeople
              // A CRM record named by its address repeats the "Gave" line above it.
              .filter((p) => !(r.givenEmails.length > 0 && p.name.includes('@')))
              .map((p) => (
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
      cellClassName: 'max-w-[14ch]',
      render: (r) => {
        const label = r.recipient ? `Email to ${r.recipient.name}` : r.eventType !== 'PAGE_VIEW' ? '—' : r.referrer ? `${r.source} · ${referrerHost(r.referrer)}` : r.source
        return (
          <div className="truncate" title={r.referrer ? `${label} (${r.referrer})` : label}>
            {label}
          </div>
        )
      },
    },
    {
      header: 'Page or click',
      render: (r) => {
        if (r.eventType === 'LINK_CLICK' && r.href) {
          return (
            <>
              {r.isApplyClick && <span className="mr-1.5 rounded bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success">Apply</span>}
              <ShortUrl url={absoluteUrl(r.href)} max="max-w-[28ch]" />
            </>
          )
        }
        if (r.path) return <ShortUrl url={absoluteUrl(r.path)} max="max-w-[28ch]" />
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
        </p>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">{showBots ? 'Page views & unique visitors, all traffic' : 'Human page views & unique visitors'}</h2>
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

      <div className="mt-4 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Visitors by type</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Human visitors per day, one line per type. A visitor is typed from the CRM (an email or unsubscribe link, a click, an address they gave), then a signed-in account, then the first page they landed on; everyone else is Unknown. Counted once per day per IP and saved each day, so it covers every day since the snapshot started.
        </p>
        <VisitorsSegmentChart chart="visitors_by_type" lines={typeLines} ranges={['7d', '30d', 'all']} note="Visitors per day (one per IP), bots excluded." emptyMessage="No typed visitors saved yet." />
      </div>
      </TrafficRangeProvider>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

      <LogControls range={logRange} sort={sort} showBots={showBots} email={email} type={typeParam} unique={unique} match={match} />

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
          baseParams: { ...(showBots ? { bots: 'show' } : {}), ...(logRange !== 'all' ? { range: logRange } : {}), ...(sort ? { sort } : {}), ...(email ? { email } : {}), ...(typeParam ? { type: typeParam } : {}), ...(unique ? { unique: '1' } : {}), ...(match.length > 0 ? { match: match.join(',') } : {}) },
        }}
      />
    </div>
  )
}
