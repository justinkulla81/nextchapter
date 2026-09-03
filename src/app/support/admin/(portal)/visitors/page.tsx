import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { VisitorsPerDayChart } from '@/components/admin/VisitorsPerDayChart'
import { classifyUserAgent } from '@/lib/http/user-agent'
import { lookupIpLocation, formatIpLocation } from '@/lib/http/ip-geolocation'
import { formatAdminDateTime } from '@/lib/admin/format-date'
import { candidateDisplayName } from '@/lib/messaging/threads'

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
  events: { createdAt: Date; userAgent: string | null; ip: string | null }[],
  options: { humanOnly: boolean; dedupeByIp: boolean }
): { dateKey: string; count: number }[] {
  const seenPerDay = new Map<string, Set<string>>() // dateKey -> set of IPs already counted, when deduping
  const counts = new Map<string, number>()

  for (const e of events) {
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

  const chartWindowStart = new Date(now().getTime() - CHART_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const [events, total, chartEvents] = await Promise.all([
    prisma.homepageVisitEvent.findMany({
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
      include: { candidate: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.homepageVisitEvent.count(),
    prisma.homepageVisitEvent.findMany({
      where: { eventType: 'PAGE_VIEW', createdAt: { gte: chartWindowStart } },
      select: { createdAt: true, userAgent: true, ip: true },
    }),
  ])

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
          {total} homepage visit events. A daily digest email also summarizes yesterday&apos;s traffic by IP.
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
