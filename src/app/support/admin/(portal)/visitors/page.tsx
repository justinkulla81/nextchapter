import Link from 'next/link'
import type { ReactNode } from 'react'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { VisitorsPerDayChart } from '@/components/admin/VisitorsPerDayChart'
import { classifyUserAgent, BOT_SIGNATURES } from '@/lib/http/user-agent'
import { classifyDevice, classifyBrowser, classifyOs } from '@/lib/http/device'
import { DeviceShareChart } from '@/components/admin/DeviceShareChart'
import { analyzeVisits } from '@/lib/admin/visitor-analytics'
import { loadSearchConsole, type SearchConsoleResult, type SearchRow } from '@/lib/google/search-console'
import { lookupIpLocation, formatIpLocation } from '@/lib/http/ip-geolocation'
import { formatAdminDateTime } from '@/lib/admin/format-date'
import { candidateDisplayName } from '@/lib/messaging/threads'
import { classifyTrafficSource, trafficSourceGroup, type TrafficSourceGroup } from '@/lib/marketing/classify-traffic-source'

export const maxDuration = 30

const CHART_WINDOW_DAYS = 30
const ET_TIME_ZONE = 'America/New_York'

// en-CA formats as YYYY-MM-DD — a clean, sortable, ET-anchored day key with
// no manual date-string parsing, matching the ET convention already
// established for this page's Time column (see format-date.ts).
function etDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: ET_TIME_ZONE })
}

// Module-level helper, not called inline inside the component body —
// Date.now() is an impure call the react-hooks/purity rule flags wherever a
// component function reads it directly (see interim-work/page.tsx's
// twoDaysAgo for the same pattern).
function now(): Date {
  return new Date()
}

// One row per calendar day in the window, oldest first, zero-filled for
// days with no traffic — a chart with silent gaps reads as "we have no data
// for that day," not "zero that day." `countFor` decides what one event
// contributes to a day's running count (1 for a page-view tally, or nothing
// beyond first-occurrence bookkeeping for a unique-visitor tally, handled
// via the `dedupeKey` below instead).
function buildPerDaySeries(
  events: { createdAt: Date; userAgent: string | null; ip: string | null; eventType: string }[],
  options: { humanOnly: boolean; dedupeByIp: boolean }
): { dateKey: string; count: number }[] {
  const seenPerDay = new Map<string, Set<string>>() // dateKey -> set of IPs already counted, when deduping
  const counts = new Map<string, number>()

  for (const e of events) {
    if (e.eventType !== 'PAGE_VIEW') continue
    if (options.humanOnly && classifyUserAgent(e.userAgent) !== 'human') continue
    const key = etDateKey(e.createdAt)

    if (options.dedupeByIp) {
      if (!e.ip) continue // can't dedupe an anonymous IP — excluded rather than double- or under-counted
      const seen = seenPerDay.get(key) ?? new Set<string>()
      if (seen.has(e.ip)) continue
      seen.add(e.ip)
      seenPerDay.set(key, seen)
    }

    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const days: { dateKey: string; count: number }[] = []
  const today = now()
  for (let i = CHART_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    const key = etDateKey(d)
    days.push({ dateKey: key, count: counts.get(key) ?? 0 })
  }
  return days
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

interface BreakdownRow {
  label: string
  count: number
}

// Human page views only, counted from the same 30-day set as the chart.
function tally(labels: string[]): BreakdownRow[] {
  const counts = new Map<string, number>()
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1)
  return Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
}

function BreakdownTable({ title, rows, note }: { title: string; rows: BreakdownRow[]; note?: string }) {
  const total = rows.reduce((sum, r) => sum + r.count, 0)
  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {note && <p className="mb-2 text-xs text-muted-foreground">{note}</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No human page views in this window yet.</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-border first:border-t-0">
                <td className="py-1 pr-2">{r.label}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{r.count}</td>
                <td className="py-1 text-right tabular-nums text-muted-foreground">{Math.round((r.count / total) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function SearchTermsTable({ title, rows }: { title: string; rows: SearchRow[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 pr-2 font-normal">{title.startsWith('Top search') ? 'Search' : 'Page'}</th>
              <th className="py-1 pr-2 text-right font-normal">Clicks</th>
              <th className="py-1 pr-2 text-right font-normal">Shown</th>
              <th className="py-1 text-right font-normal">Avg position</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border">
                <td className="max-w-xs break-words py-1 pr-2">{r.key}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{r.clicks}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{r.impressions}</td>
                <td className="py-1 text-right tabular-nums">{r.position.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function SearchConsoleSection({ result }: { result: SearchConsoleResult }) {
  const connectHref = '/api/google/oauth/start?from=/support/admin/visitors'
  const connectLink = (
    <Link href={connectHref} className="text-primary underline underline-offset-4">
      Connect Google
    </Link>
  )
  let body: ReactNode
  if (result.status === 'ok') {
    body = (
      <div className="grid gap-6 md:grid-cols-2">
        <SearchTermsTable title="Top search terms" rows={result.queries} />
        <SearchTermsTable title="Top pages from Google search" rows={result.pages} />
      </div>
    )
  } else if (result.status === 'not_connected') {
    body = <p className="text-sm text-muted-foreground">No Google account is connected yet. {connectLink} to see the search terms people use.</p>
  } else if (result.status === 'needs_reconnect') {
    body = (
      <p className="text-sm text-muted-foreground">
        The connected Google account was authorized before Search Console access was added, or it does not own the site. {connectLink} again and tick the Search Console permission, using an account that is an owner or user of the launchyournextchapter.com property.
      </p>
    )
  } else if (result.status === 'no_site') {
    body = (
      <p className="text-sm text-muted-foreground">
        The connected Google account has no Search Console property for launchyournextchapter.com
        {result.sites.length > 0 ? ` (it can see: ${result.sites.join(', ')})` : ''}. Add and verify the site at Search Console, then reload.
      </p>
    )
  } else {
    body = <p className="text-sm text-muted-foreground">Search Console could not be read right now: {result.message}</p>
  }
  return (
    <div className="rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium text-foreground">What people search on Google to find us</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        {result.status === 'ok'
          ? `From Google Search Console (${result.siteUrl}), ${result.startDate} to ${result.endDate}. Google lags about two days and hides very rare searches.`
          : 'From Google Search Console — the only place Google shares actual search terms.'}
      </p>
      {body}
    </div>
  )
}

// Anonymous public-marketing traffic (every public page, not just the
// homepage — see HomepageVisitTracker's own comment) — never candidate/
// coach/recruiter/admin app usage (that's the separate Login History and
// Page activity sections on the candidate detail page). The site owner's
// own devices (TRUSTED_OWNER_IPS) are never recorded at all, so they never
// show up here.
export default async function AdminVisitorsPage({
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

  const chartWindowStart = new Date(now().getTime() - CHART_WINDOW_DAYS * 24 * 60 * 60 * 1000)

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
      select: { createdAt: true, userAgent: true, ip: true, path: true, referrer: true, eventType: true, href: true, candidateId: true },
      take: 100000,
    }),
  ])

  const humanAllEvents = chartEvents.filter((e) => classifyUserAgent(e.userAgent) === 'human')
  const humanChartEvents = humanAllEvents.filter((e) => e.eventType === 'PAGE_VIEW')
  const sourceLabels = humanChartEvents.map((e) => classifyTrafficSource(e.path, e.referrer))
  const groupOrder: TrafficSourceGroup[] = ['AI assistants', 'Search engines', 'Google for Jobs', 'Social', 'Email', 'Direct', 'Internal', 'Other sites']
  const groupCounts = tally(sourceLabels.map(trafficSourceGroup))
  const sourceGroups = groupOrder.map((g) => groupCounts.find((c) => c.label === g) ?? { label: g, count: 0 }).filter((r) => r.count > 0)
  const aiAndSearchDetail = tally(sourceLabels.filter((l) => ['AI assistants', 'Search engines', 'Google for Jobs'].includes(trafficSourceGroup(l))))
  const osRows = tally(humanChartEvents.map((e) => classifyOs(e.userAgent)))
  const browserRows = tally(humanChartEvents.map((e) => classifyBrowser(e.userAgent)))
  const searchConsole = await loadSearchConsole()
  const analysis = analyzeVisits(humanAllEvents, {
    dayKey: etDateKey,
    dateKeys: Array.from({ length: CHART_WINDOW_DAYS }, (_, i) => etDateKey(new Date(now().getTime() - (CHART_WINDOW_DAYS - 1 - i) * 24 * 60 * 60 * 1000))),
  })

  // Names and locations only for the people actually shown (top 25), so the
  // free IP-geolocation tier is not hit once per visitor.
  const shownPeople = analysis.people.slice(0, 25)
  const personLocations = new Map(
    await Promise.all(shownPeople.map(async (p) => [p.ip, formatIpLocation(await lookupIpLocation(p.ip))] as const))
  )
  const personCandidateIds = shownPeople.map((p) => p.candidateId).filter((id): id is string => !!id)
  const personCandidates = new Map(
    (personCandidateIds.length
      ? await prisma.candidateProfile.findMany({ where: { id: { in: personCandidateIds } }, select: { id: true, firstName: true, lastName: true } })
      : []
    ).map((c) => [c.id, c] as const)
  )

  const humanPageViewsPerDay = buildPerDaySeries(chartEvents, { humanOnly: true, dedupeByIp: false })
  const uniqueVisitorsPerDay = buildPerDaySeries(chartEvents, { humanOnly: true, dedupeByIp: true })

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
        <h1 className="text-2xl font-semibold tracking-tight">Visitors</h1>
        <p className="mt-1 text-muted-foreground">
          {total} {showBots ? '' : 'human '}homepage visit events. A daily digest email also summarizes yesterday&apos;s
          traffic by IP.{' '}
          <Link
            href={showBots ? '/support/admin/visitors' : '/support/admin/visitors?bots=show'}
            className="text-primary underline underline-offset-4"
          >
            {showBots ? 'Hide bots' : 'Show bots'}
          </Link>
        </p>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Human page views &amp; unique visitors per day</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Last {CHART_WINDOW_DAYS} days, bots excluded. Unique visitors is deduped by IP.
        </p>
        <VisitorsPerDayChart
          series={[
            { label: 'Human page views', days: humanPageViewsPerDay, color: 'var(--color-brand)' },
            { label: 'Unique visitors', days: uniqueVisitorsPerDay, color: 'var(--color-warning)' },
          ]}
          emptyMessage="No visitor activity in this window yet."
        />
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Mobile vs desktop</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Share of human visits by device, last {CHART_WINDOW_DAYS} days. A visit is one person (IP address) on one day.
        </p>
        <DeviceShareChart days={analysis.device.perDay} overall={analysis.device.overall} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BreakdownTable
          title="Where visitors come from"
          rows={sourceGroups}
          note={`Last ${CHART_WINDOW_DAYS} days, human page views. Many AI apps and mail apps send no referrer and show up as Direct, so AI is a floor, not a total.`}
        />
        <BreakdownTable
          title="AI assistants, search engines and Google for Jobs"
          rows={aiAndSearchDetail}
          note="Gemini, ChatGPT, Perplexity, Claude, Copilot, Google, Bing, DuckDuckGo and Google for Jobs, one row each."
        />
        <BreakdownTable title="Operating system" rows={osRows} />
        <BreakdownTable title="Browser" rows={browserRows} />
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Where visitors land, and where they came from</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          The first page each person saw on each day, and the source that sent them. Job posting pages are grouped into one row.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <BreakdownTable title="Landing pages" rows={analysis.landing.pages} />
          <div>
            <h3 className="text-sm font-medium text-foreground">Source → landing page</h3>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {analysis.landing.bySourceAndPage.map((r) => (
                  <tr key={`${r.source}${r.page}`} className="border-t border-border first:border-t-0">
                    <td className="py-1 pr-2">{r.source}</td>
                    <td className="py-1 pr-2 break-all text-muted-foreground">{r.page}</td>
                    <td className="py-1 text-right tabular-nums">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <BreakdownTable title="Where they go: outside sites clicked" rows={analysis.destinations.outboundHosts} note="Links that leave NextChapter, such as Apply buttons." />
          <BreakdownTable title="Where they go: our own pages clicked" rows={analysis.destinations.internalClicks} />
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Clicks per person per day</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Across {analysis.visitorDays} visits ({analysis.visitors} different people) in the last {CHART_WINDOW_DAYS} days. People who looked at one page and left count as one page and zero clicks.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 font-normal"></th>
              <th className="py-1 text-right font-normal">Average</th>
              <th className="py-1 text-right font-normal">Median</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border">
              <td className="py-1">Pages viewed per person per day</td>
              <td className="py-1 text-right tabular-nums">{analysis.perVisitorDay.pageViews.average.toFixed(2)}</td>
              <td className="py-1 text-right tabular-nums">{analysis.perVisitorDay.pageViews.median}</td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-1">Link clicks per person per day</td>
              <td className="py-1 text-right tabular-nums">{analysis.perVisitorDay.linkClicks.average.toFixed(2)}</td>
              <td className="py-1 text-right tabular-nums">{analysis.perVisitorDay.linkClicks.median}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Application pages vs the rest of the site</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Application pages are individual job postings (the pages with an Apply button). An apply click is a click from a job posting to the employer&apos;s own site.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <BreakdownTable
            title="Page views by type"
            rows={[
              { label: 'Job posting pages', count: analysis.application.jobPageViews },
              { label: 'Job search page', count: analysis.application.jobSearchViews },
              { label: 'Everything else', count: analysis.application.otherViews },
            ].filter((r) => r.count > 0)}
          />
          <div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-t border-border first:border-t-0">
                  <td className="py-1">Visits that opened a job posting</td>
                  <td className="py-1 text-right tabular-nums">{analysis.application.visitorsViewingJobPage}</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-1">Different job postings opened per visit</td>
                  <td className="py-1 text-right tabular-nums">{analysis.application.avgJobPagesPerVisitorDay.toFixed(2)}</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-1">Apply clicks</td>
                  <td className="py-1 text-right tabular-nums">{analysis.application.applyClicks}</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-1">Visits with at least one apply click</td>
                  <td className="py-1 text-right tabular-nums">{analysis.application.visitorsClickingApply}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <BreakdownTable title="Where apply clicks went" rows={analysis.application.applyDestinations} />
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Lead-gen flow</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          The lead-gen flow is the /start journeys, resume and search-firm submit forms, membership, sign-up and booking. A lead-gen click is a click on a link into one of those pages.
        </p>
        <table className="mb-3 w-full text-sm">
          <tbody>
            <tr className="border-t border-border first:border-t-0">
              <td className="py-1">Lead-gen clicks</td>
              <td className="py-1 text-right tabular-nums">{analysis.leadGen.clicks}</td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-1">Lead-gen clicks per person per day (all visits)</td>
              <td className="py-1 text-right tabular-nums">{analysis.leadGen.avgClicksPerVisitorDay.toFixed(2)}</td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-1">Lead-gen clicks per person per day (only visits that reached the flow)</td>
              <td className="py-1 text-right tabular-nums">{analysis.leadGen.avgClicksPerVisitorDayAmongReachers.toFixed(2)}</td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-1">Visits that reached the flow</td>
              <td className="py-1 text-right tabular-nums">
                {analysis.leadGen.visitorsReaching} of {analysis.visitorDays}
                {analysis.visitorDays ? ` (${Math.round((analysis.leadGen.visitorsReaching / analysis.visitorDays) * 100)}%)` : ''}
              </td>
            </tr>
          </tbody>
        </table>
        <VisitorsPerDayChart
          series={[
            { label: 'Lead-gen clicks', days: analysis.leadGen.perDay.map((d) => ({ dateKey: d.dateKey, count: d.clicks })), color: 'var(--color-brand)' },
            { label: 'People visiting', days: analysis.leadGen.perDay.map((d) => ({ dateKey: d.dateKey, count: d.visitors })), color: 'var(--color-warning)' },
          ]}
          emptyMessage="No lead-gen clicks in this window yet."
        />
        <div className="mt-3">
          <BreakdownTable title="Which lead-gen pages get the clicks" rows={analysis.leadGen.byEntry} />
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">People who looked at more than one page</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Last {CHART_WINDOW_DAYS} days, most different pages first. {analysis.people.length} people viewed two or more pages; the top {shownPeople.length} are shown. Job postings count as one page type.
        </p>
        {shownPeople.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody has viewed more than one page yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-2 font-normal">Person</th>
                <th className="py-1 pr-2 text-right font-normal">Pages</th>
                <th className="py-1 pr-2 text-right font-normal">Views</th>
                <th className="py-1 pr-2 text-right font-normal">Clicks</th>
                <th className="py-1 pr-2 font-normal">Most viewed</th>
                <th className="py-1 font-normal">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {shownPeople.map((p) => {
                const c = p.candidateId ? personCandidates.get(p.candidateId) : null
                return (
                  <tr key={p.ip} className="border-t border-border align-top">
                    <td className="py-1 pr-2">
                      {c ? (
                        <Link href={`/support/admin/candidates/${c.id}`} className="text-primary underline underline-offset-4">
                          {candidateDisplayName(c)}
                        </Link>
                      ) : (
                        'Anonymous'
                      )}
                      <div className="text-xs text-muted-foreground">
                        {p.ip} · {personLocations.get(p.ip) ?? 'location unknown'}
                      </div>
                    </td>
                    <td className="py-1 pr-2 text-right tabular-nums">{p.distinctPages}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{p.pageViews}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{p.linkClicks}</td>
                    <td className="py-1 pr-2 break-all text-muted-foreground">{p.topPages.join(', ')}</td>
                    <td className="py-1 tabular-nums">{formatAdminDateTime(p.lastSeen)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <SearchConsoleSection result={searchConsole} />

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
          baseParams: showBots ? { bots: 'show' } : {},
        }}
      />
    </div>
  )
}
