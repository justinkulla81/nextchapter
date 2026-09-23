import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { CRM_ACTIVITY_CUTOFF } from '@/lib/crm/cutoff'
import { CrmPeekPanel, CrmPeekButton } from '@/components/admin/CrmPeekPanel'
import { CrmSyncNowButton } from '@/components/admin/CrmSyncNowButton'
import { CrmEmailChart, type EmailDay } from '@/components/admin/CrmEmailChart'
import { priorityTierClass } from '@/lib/crm/labels'

export const maxDuration = 30

const DAY = 86_400_000
const CHART_DAYS = 30
const WEEK_DAYS = 7
const FEED_SIZE = 50
// Days are bucketed where the work happens. UTC midnight is 8pm here, so an
// evening's outreach would otherwise be split across two days on the chart.
const TZ = 'America/New_York'

/**
 * Which origins count as "people added", and their labels for the breakdown.
 *
 * An allowlist, not "everything but the spreadsheets": the week the CRM was
 * seeded, a bulk import put 3,600 rows in one afternoon and "people added"
 * read 3,791 — true, and useless. Four ways someone legitimately joins the
 * CRM in the course of working it: captured by the extension, added by
 * hand, found by the sync because a message actually mentioned
 * NextChapter, or approved off the Review List. A SYNC-sourced person with
 * no confirmed (non-review) activity is excluded from that third bucket —
 * an inbound message that never mentions NextChapter can no longer create
 * a person at all, but an unreviewed OUTBOUND one still can, and that
 * alone isn't yet "because it mentioned NextChapter" (see the SQL below).
 * A new import format stays out until someone decides it belongs here.
 */
const ADDED_SOURCES: Record<string, string> = {
  CHROME_EXTENSION: 'extension',
  QUICK_ADD: 'added by hand',
  MANUAL: 'added by hand',
  SYNC: 'mentioned NextChapter',
  REVIEWED: 'approved by review',
}

function localDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ }) // en-CA formats as YYYY-MM-DD
}

function snippet(body: string | null, max = 160): string {
  if (!body) return ''
  // The first thing they wrote, not the quoted thread below it.
  const cut = body.split(/\r?\n(?:On .{5,120}wrote:|-{2,}\s*Original Message|From: )/)[0]
  const flat = cut.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

function when(d: Date): string {
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / 60000))}m ago`
  if (localDate(d) === localDate(new Date(now))) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ })
}

/**
 * The Ecosystem's front page: is outreach happening, and what came back.
 *
 * Deliberately a read-out, not another worklist — the queues are where you
 * act. This answers "how was the week" in one screen: the email trend on
 * top, the numbers that move beneath it, then every email in order. Each
 * number links to the filtered People view it summarises.
 */
export default async function CrmHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams
  const before = sp.before ? new Date(sp.before) : null

  const now = new Date()
  // Nothing before the CRM's cutoff exists as activity, so the chart never
  // reaches back past it — an empty June would read as a slow June.
  // A day wider than the window, so the first local day is complete whatever
  // the offset; rows outside the listed days are simply not plotted.
  const chartStart = new Date(Math.max(CRM_ACTIVITY_CUTOFF.getTime(), now.getTime() - (CHART_DAYS + 1) * DAY))
  const weekAgo = new Date(now.getTime() - WEEK_DAYS * DAY)

  const [daily, feedRows, addedWeek, approvedWeek, updatedWeek, waiting, tiers, weekTotals, response, needsReviewCount] =
    await Promise.all([
      prisma.$queryRaw<{ day: string; direction: string; n: number }[]>`
        SELECT to_char((a."occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day,
               a.direction::text AS direction,
               -- Messages, not rows: one email to five contacts is five activity
               -- rows (one per person) and was counted five times.
               COUNT(DISTINCT COALESCE(split_part(a."sourceRef", ':', 1), a.id))::int AS n
        FROM "CrmActivity" a
        JOIN "CrmPerson" p ON p.id = a."personId" AND p."deletedAt" IS NULL
        WHERE a.type = 'EMAIL' AND a."needsReview" = false AND a."occurredAt" >= ${chartStart}
        GROUP BY 1, 2`,
      prisma.crmActivity.findMany({
        where: {
          type: 'EMAIL',
          needsReview: false,
          occurredAt: { gte: CRM_ACTIVITY_CUTOFF, ...(before ? { lt: before } : {}) },
          person: { deletedAt: null },
        },
        orderBy: { occurredAt: 'desc' },
        // Rows, not messages — a group email is one row per person on it, so
        // over-fetch and fold them back into messages below.
        take: FEED_SIZE * 3,
        select: {
          id: true, occurredAt: true, direction: true, subject: true, body: true, sourceRef: true,
          person: { select: { id: true, fullName: true, priority: true } },
        },
      }),
      // Origin allowlist — see ADDED_SOURCES. A SYNC-sourced person (no
      // CrmSourceRecord) only counts once they have at least one CONFIRMED
      // activity: since the mention-gate change, an inbound message that
      // never mentions NextChapter can no longer create one at all, but an
      // unreviewed outbound message still can — and that alone isn't yet
      // "because it mentioned NextChapter".
      prisma.$queryRaw<{ src: string; n: number }[]>`
        WITH first_src AS (
          SELECT DISTINCT ON (s."personId") s."personId", s."sourceFile"::text AS src
          FROM "CrmSourceRecord" s
          ORDER BY s."personId", s."importedAt" ASC
        )
        SELECT COALESCE(fs.src, 'SYNC') AS src, COUNT(*)::int AS n
        FROM "CrmPerson" p
        LEFT JOIN first_src fs ON fs."personId" = p.id
        WHERE p."deletedAt" IS NULL AND p."createdAt" >= ${weekAgo}
          AND (
            COALESCE(fs.src, 'SYNC') IN ('CHROME_EXTENSION', 'QUICK_ADD', 'MANUAL')
            OR (
              COALESCE(fs.src, 'SYNC') = 'SYNC'
              AND EXISTS (SELECT 1 FROM "CrmActivity" a WHERE a."personId" = p.id AND a."needsReview" = false)
            )
          )
        GROUP BY 1`,
      // Approved off the Review List this week — a person created earlier
      // whose needsCompletion cleared this week (see completionClearedAt).
      // Excludes anyone created this week too, so they're not double
      // counted against the bucket above.
      prisma.crmPerson.count({
        where: { deletedAt: null, completionClearedAt: { gte: weekAgo }, createdAt: { lt: weekAgo } },
      }),
      // "Updated" means a person edited the record — every field change is
      // logged as FIELD_CHANGED. The sync rewriting touch counts is not an
      // update anyone made, and updatedAt can't tell the two apart.
      prisma.crmActivity.findMany({
        where: { type: { in: ['FIELD_CHANGED', 'STAGE_CHANGED'] }, occurredAt: { gte: weekAgo }, person: { deletedAt: null } },
        distinct: ['personId'], select: { personId: true },
      }).then((r) => r.length),
      prisma.crmPerson.count({ where: { deletedAt: null, awaitingReplySince: { not: null } } }),
      prisma.crmPerson.groupBy({ by: ['priority'], where: { deletedAt: null, priority: { not: null } }, _count: { _all: true } }),
      prisma.$queryRaw<{ direction: string; n: number; people: number }[]>`
        SELECT a.direction::text AS direction,
               COUNT(DISTINCT COALESCE(split_part(a."sourceRef", ':', 1), a.id))::int AS n,
               COUNT(DISTINCT a."personId")::int AS people
        FROM "CrmActivity" a
        JOIN "CrmPerson" p ON p.id = a."personId" AND p."deletedAt" IS NULL
        WHERE a.type = 'EMAIL' AND a."needsReview" = false AND a."occurredAt" >= ${weekAgo}
        GROUP BY 1`,
      // Response rate: of the people you've reached out to since the cutoff —
      // by email, LinkedIn message, call or a logged text, not meetings (a
      // meeting isn't outreach) — what fraction have replied since. A message
      // from them BEFORE you first wrote isn't a reply to anything. All-time,
      // and for just the people first reached this week (a reply can land
      // after the week ends; "replied" means at all, not necessarily yet).
      prisma.$queryRaw<{ emailed_total: number; replied_total: number; emailed_week: number; replied_week: number }[]>`
        WITH emailed AS (
          SELECT a."personId" AS pid, MIN(a."occurredAt") AS first_sent
          FROM "CrmActivity" a
          JOIN "CrmPerson" p ON p.id = a."personId" AND p."deletedAt" IS NULL
          WHERE a.type IN ('EMAIL', 'LINKEDIN_MESSAGE', 'CALL', 'NOTE') AND a.direction = 'OUTBOUND'
            AND a."needsReview" = false AND a."occurredAt" >= ${CRM_ACTIVITY_CUTOFF}
          GROUP BY a."personId"
        ),
        replied AS (
          SELECT DISTINCT a."personId" AS pid
          FROM "CrmActivity" a
          JOIN emailed e ON e.pid = a."personId" AND a."occurredAt" > e.first_sent
          WHERE a.direction = 'INBOUND' AND a."needsReview" = false
        )
        SELECT
          COUNT(*)::int AS emailed_total,
          COUNT(*) FILTER (WHERE r.pid IS NOT NULL)::int AS replied_total,
          COUNT(*) FILTER (WHERE e.first_sent >= ${weekAgo})::int AS emailed_week,
          COUNT(*) FILTER (WHERE e.first_sent >= ${weekAgo} AND r.pid IS NOT NULL)::int AS replied_week
        FROM emailed e
        LEFT JOIN replied r ON r.pid = e.pid`,
      prisma.crmActivity.count({ where: { needsReview: true, person: { deletedAt: null } } }),
    ])

  // Every day in the window, including silent ones — a gap in the line is
  // a day with no email, and that is worth seeing as a zero.
  const byDay = new Map<string, EmailDay>()
  const firstDay = localDate(CRM_ACTIVITY_CUTOFF)
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const d = localDate(new Date(now.getTime() - i * DAY))
    if (d >= firstDay) byDay.set(d, { date: d, sent: 0, received: 0 })
  }
  for (const r of daily) {
    const row = byDay.get(r.day)
    if (!row) continue
    if (r.direction === 'OUTBOUND') row.sent += r.n
    else if (r.direction === 'INBOUND') row.received += r.n
  }
  const days = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))

  const sentWeek = weekTotals.find((r) => r.direction === 'OUTBOUND')?.n ?? 0
  const receivedWeek = weekTotals.find((r) => r.direction === 'INBOUND')?.n ?? 0
  const sentPeopleWeek = weekTotals.find((r) => r.direction === 'OUTBOUND')?.people ?? 0

  // One entry per email, listing everyone it involved.
  type FeedItem = (typeof feedRows)[number] & { people: NonNullable<(typeof feedRows)[number]['person']>[] }
  const feedByMsg = new Map<string, FeedItem>()
  for (const r of feedRows) {
    const key = r.sourceRef?.split(':')[0] ?? r.id
    const existing = feedByMsg.get(key)
    if (existing) {
      if (r.person && !existing.people.some((p) => p.id === r.person!.id)) existing.people.push(r.person)
    } else if (feedByMsg.size < FEED_SIZE) {
      feedByMsg.set(key, { ...r, people: r.person ? [r.person] : [] })
    }
  }
  const feed = [...feedByMsg.values()]

  const tierCount = (t: 'P0' | 'P1' | 'P2') => tiers.find((x) => x.priority === t)?._count._all ?? 0

  const addedBy = new Map<string, number>()
  for (const r of addedWeek) {
    const label = ADDED_SOURCES[r.src]
    if (label) addedBy.set(label, (addedBy.get(label) ?? 0) + r.n)
  }
  if (approvedWeek > 0) addedBy.set(ADDED_SOURCES.REVIEWED, (addedBy.get(ADDED_SOURCES.REVIEWED) ?? 0) + approvedWeek)
  const addedTotal = [...addedBy.values()].reduce((a, b) => a + b, 0)
  const addedHint = addedTotal > 0
    ? [...addedBy.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join(' · ')
    : 'last 7 days'
  const nextBefore = feed.length === FEED_SIZE ? feed[feed.length - 1].occurredAt.toISOString() : null

  const resp = response[0] ?? { emailed_total: 0, replied_total: 0, emailed_week: 0, replied_week: 0 }
  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0)
  const allTimeReplyRate = pct(resp.replied_total, resp.emailed_total)

  const stats: { label: string; value: string; hint: string; href: string; tone?: string }[] = [
    { label: 'People added this week', value: String(addedTotal), hint: addedHint, href: '/support/admin/crm/needs-completion' },
    { label: 'Records updated this week', value: String(updatedWeek), hint: 'edited by you', href: '/support/admin/crm' },
    { label: 'Waiting on a reply', value: String(waiting), hint: 'you spoke last', href: '/support/admin/crm?waiting=waiting' },
    {
      // Messages, not people — the hint gives the people behind them, so the
      // figure can't be read against the response rate's people-count below.
      label: 'Emails sent this week', value: String(sentWeek),
      hint: `to ${sentPeopleWeek} ${sentPeopleWeek === 1 ? 'person' : 'people'} · ${receivedWeek} received`,
      href: '/support/admin/crm/home',
    },
    {
      label: 'Response rate', value: `${allTimeReplyRate}%`,
      hint: `${resp.replied_total} of ${resp.emailed_total} people you reached out to replied` +
        (resp.emailed_week > 0 ? ` · this week ${resp.replied_week} of ${resp.emailed_week}` : ''),
      href: '/support/admin/crm?waiting=not-waiting',
    },
    { label: 'P0', value: String(tierCount('P0')), hint: 'Immediate', href: '/support/admin/crm?priority=P0', tone: priorityTierClass('P0') },
    { label: 'P1', value: String(tierCount('P1')), hint: 'High', href: '/support/admin/crm?priority=P1', tone: priorityTierClass('P1') },
    { label: 'P2', value: String(tierCount('P2')), hint: 'Not urgent', href: '/support/admin/crm?priority=P2', tone: priorityTierClass('P2') },
  ]

  return (
    <div className="space-y-6">
      <CrmPeekPanel />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ecosystem</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Outreach at a glance — what went out, what came back, and where things stand.
          </p>
        </div>
        <CrmSyncNowButton />
      </header>

      {needsReviewCount > 0 && (
        <Link
          href="/support/admin/crm/needs-review"
          className="flex items-center gap-2 rounded-lg border border-orange/40 bg-orange/5 px-3 py-2 text-sm hover:border-orange"
        >
          <span className="rounded-full bg-orange/20 px-1.5 py-0.5 text-xs font-semibold text-orange">
            {needsReviewCount}
          </span>
          <span>
            outbound {needsReviewCount === 1 ? 'email doesn\u2019t' : 'emails don\u2019t'} mention NextChapter and
            {needsReviewCount === 1 ? ' needs' : ' need'} review before counting as outreach
          </span>
          <span className="ml-auto font-medium text-orange">Review →</span>
        </Link>
      )}

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Emails per day</h2>
          <p className="text-sm text-muted-foreground">
            Last 7 days: <span className="font-medium tabular-nums text-foreground">{sentWeek}</span> sent ·{' '}
            <span className="font-medium tabular-nums text-foreground">{receivedWeek}</span> received
          </p>
        </div>
        <CrmEmailChart days={days} />
      </section>

      <section aria-label="Stats" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-lg border border-border bg-card p-3 hover:border-brand">
            <p className="text-xs text-muted-foreground">
              {s.tone ? <span className={`rounded px-1.5 py-0.5 font-semibold ${s.tone}`}>{s.label}</span> : s.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>
          </Link>
        ))}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Email activity</h2>
          {before && (
            <Link href="/support/admin/crm/home" className="text-sm text-brand underline">Back to latest</Link>
          )}
        </div>

        {feed.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No email activity yet. Sync now pulls in anything recent.
          </p>
        ) : (
          <ul className="viz-root divide-y divide-border rounded-lg border border-border bg-card">
            {feed.map((a) => {
              const out = a.direction === 'OUTBOUND'
              return (
                <li key={a.id} className="flex gap-3 px-3 py-2.5">
                  <span
                    className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: out ? 'var(--viz-series-1)' : 'var(--viz-series-2)' }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="text-xs font-medium text-muted-foreground">{out ? 'You →' : 'From'}</span>
                      {a.people.length === 0 && <span>Unknown</span>}
                      {a.people.slice(0, 3).map((p, i) => (
                        <span key={p.id} className="inline-flex items-baseline gap-1">
                          {i > 0 && <span className="text-muted-foreground">,</span>}
                          <CrmPeekButton id={p.id} kind="person">{p.fullName}</CrmPeekButton>
                          {p.priority && (
                            <span className={`rounded px-1 text-xs font-semibold ${priorityTierClass(p.priority)}`}>
                              {p.priority}
                            </span>
                          )}
                        </span>
                      ))}
                      {a.people.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{a.people.length - 3} more</span>
                      )}
                      <span className="truncate font-medium">{a.subject || '(no subject)'}</span>
                    </p>
                    {snippet(a.body) && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{snippet(a.body)}</p>
                    )}
                  </div>
                  <time dateTime={a.occurredAt.toISOString()} className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {when(a.occurredAt)}
                  </time>
                </li>
              )
            })}
          </ul>
        )}

        {nextBefore && (
          <div className="mt-3 text-center">
            <Link
              href={`/support/admin/crm/home?before=${encodeURIComponent(nextBefore)}`}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Older
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
