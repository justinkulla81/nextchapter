import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  matchPlace,
  matchSearchDoc,
  normalizeSearchText,
  parseLocationQuery,
  parseSearchQuery,
  isEmptyQuery,
  type BoardSearchParams,
} from '@/lib/jobs/board-search'
import { FRESH_DAYS_DEFAULT, FRESH_DAYS_SENIOR, jobLifecycle, type JobLifecycle } from '@/lib/jobs/job-status'
import { getClosedPostingCounts } from '@/lib/jobs/ghost-risk-data'
import { repostKey } from '@/lib/jobs/ghost-risk'

// Read side of current vs past jobs (job-status.ts): the lifecycle of board
// postings a member saved or opened, the "Include past jobs" search, and the
// per-company and market-wide lifecycle numbers. Past jobs come from
// CompanyJobOpening (it keeps closed rows, with pay, dates, level and function) —
// never from BoardLightRow, which holds the live board only.

// ── Board postings (My jobs, the job page) ──────────────────────────────────

export interface PostingLifecycle extends JobLifecycle {
  id: string
  title: string
  companyName: string
}

const lifecycleSelect = {
  id: true, title: true, companyName: true, location: true, archivedAt: true, expiresAt: true, closeReason: true,
  postedAt: true, createdAt: true, level: true, reopenCount: true, repostCount: true, repostFirstSeenAt: true, duplicateCount: true,
} as const

type LifecycleRow = Prisma.ExclusiveJobPostingGetPayload<{ select: typeof lifecycleSelect }>

async function withPriorClosures(rows: LifecycleRow[], now: Date): Promise<Map<string, PostingLifecycle>> {
  let counts: Map<string, number> | null = null
  try {
    counts = await getClosedPostingCounts()
  } catch (error) {
    console.error('past jobs: closed-posting counts unavailable', error)
  }
  const out = new Map<string, PostingLifecycle>()
  for (const r of rows) {
    // The closed-before count includes this very posting once it is closed itself.
    const prior = counts?.get(repostKey(r.companyName, r.title, r.location)) ?? 0
    const life = jobLifecycle({ ...r, priorClosedCount: r.archivedAt ? Math.max(0, prior - 1) : prior }, now)
    out.set(r.id, { ...life, id: r.id, title: r.title, companyName: r.companyName })
  }
  return out
}

/** Lifecycle of each board posting (ExclusiveJobPosting ids); missing ids are left out. */
export async function loadPostingLifecycles(ids: string[], now: Date = new Date()): Promise<Map<string, PostingLifecycle>> {
  if (ids.length === 0) return new Map()
  const rows = await prisma.exclusiveJobPosting.findMany({ where: { id: { in: ids.slice(0, 500) } }, select: lifecycleSelect })
  return withPriorClosures(rows, now)
}

export async function loadPostingLifecycle(id: string, now: Date = new Date()): Promise<PostingLifecycle | null> {
  return (await loadPostingLifecycles([id], now)).get(id) ?? null
}

// ── "Include past jobs" search ──────────────────────────────────────────────

export interface PastJobView {
  id: string
  title: string
  companyName: string
  companyId: string
  /** The company page slug (Company.canonicalNameNormalized). */
  companySlug: string | null
  location: string | null
  seniorityGroup: string | null
  function: string | null
  payMin: number | null
  payMax: number | null
  openedAt: string
  closedAt: string
  daysOpen: number
  status: 'closed' | 'expired'
}

/** At most this many past jobs per search — research, not a second board. */
export const PAST_JOBS_LIMIT = 50
// Rows the indexed SQL pre-filter hands to the exact matcher (newest closures first).
const PREFILTER_ROWS = 600

const strip = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Closed jobs matching the board search (same words, company:, -exclusions,
 * location and remote rules as the live board), most recently closed first.
 * One SQL pre-filter walks the closedAt index — every search word must appear,
 * punctuation-blind, in the title, company or function — then the board's exact
 * matcher keeps the real matches. Needs a keyword or company: a location alone
 * would just list every closed job in a state.
 */
export async function searchPastJobs(search: BoardSearchParams, limit = PAST_JOBS_LIMIT): Promise<PastJobView[]> {
  const parsed = parseSearchQuery(search.q)
  if (isEmptyQuery(parsed) || (parsed.terms.length === 0 && parsed.companies.length === 0)) return []
  const loc = parseLocationQuery(search.loc)
  // The punctuation-blind haystack, computed once per row (h.hay below).
  const hay = Prisma.sql`h.hay`
  // Collapsed duplicates are current jobs, never past ones.
  const conds: Prisma.Sql[] = [Prisma.sql`o."closedAt" IS NOT NULL`, Prisma.sql`o."closeReason" IS DISTINCT FROM 'duplicate'`]
  for (const t of parsed.terms) {
    const forms = t.forms.map(strip).filter(Boolean)
    if (forms.length === 0) continue
    conds.push(Prisma.sql`(${Prisma.join(forms.map((f) => Prisma.sql`${hay} LIKE ${`%${f}%`}`), ' OR ')})`)
  }
  for (const c of parsed.companies) {
    const f = strip(c)
    if (f) conds.push(Prisma.sql`regexp_replace(lower(o."companyName"), '[^a-z0-9]', '', 'g') LIKE ${`%${f}%`}`)
  }
  if (loc && loc.states.length > 0 && search.remote !== 'remote') conds.push(Prisma.sql`o."states" && ${loc.states}::text[]`)
  if (search.remote === 'remote') conds.push(Prisma.sql`o."isRemote" = true`)

  const rows = await prisma.$queryRaw<
    {
      id: string; title: string; companyName: string; companyId: string; companySlug: string | null; location: string | null; states: string[]; isRemote: boolean
      seniorityGroup: string | null; function: string | null; industry: string | null; level: string | null
      payAnnualMin: number | null; payAnnualMax: number | null; postedAt: Date | null; firstSeenAt: Date; closedAt: Date; closeReason: string | null
    }[]
  >`
    SELECT o."id", o."title", o."companyName", o."companyId", o."location", o."states", o."isRemote", o."seniorityGroup",
           o."function", o."industry", o."level", o."payAnnualMin", o."payAnnualMax", o."postedAt", o."firstSeenAt",
           o."closedAt", o."closeReason", c."canonicalNameNormalized" AS "companySlug"
    FROM "CompanyJobOpening" o
    -- OFFSET 0 keeps the subquery from being inlined, so the regexp runs once per row, not once per search word.
    CROSS JOIN LATERAL (
      SELECT regexp_replace(lower(o."title" || ' ' || o."companyName" || ' ' || coalesce(o."function", '')), '[^a-z0-9]', '', 'g') AS hay OFFSET 0
    ) h
    LEFT JOIN "Company" c ON c."id" = o."companyId"
    WHERE ${Prisma.join(conds, ' AND ')}
    ORDER BY o."closedAt" DESC
    LIMIT ${PREFILTER_ROWS}
  `
  const out: PastJobView[] = []
  for (const r of rows) {
    const doc = { title: normalizeSearchText(r.title), company: normalizeSearchText(r.companyName), role: [normalizeSearchText(r.function)], industry: normalizeSearchText(r.industry) }
    if (matchSearchDoc(doc, parsed) === null) continue
    // Remote is all we know about arrangement here; hybrid/on-site can't be told apart.
    const arrangement = r.isRemote ? 'remote' : null
    if (search.remote !== 'hybrid' && !matchPlace({ arrangement, states: r.states, text: normalizeSearchText(r.location) }, loc, search.remote)) continue
    const life = jobLifecycle({ archivedAt: r.closedAt, closeReason: r.closeReason, postedAt: r.postedAt, createdAt: r.firstSeenAt, level: r.level ?? r.seniorityGroup })
    out.push({
      id: r.id,
      title: r.title,
      companyName: r.companyName,
      companyId: r.companyId,
      companySlug: r.companySlug,
      location: r.location,
      seniorityGroup: r.seniorityGroup,
      function: r.function,
      payMin: r.payAnnualMin,
      payMax: r.payAnnualMax,
      openedAt: (r.postedAt ?? r.firstSeenAt).toISOString(),
      closedAt: r.closedAt.toISOString(),
      daysOpen: life.daysOpen,
      status: life.status === 'expired' ? 'expired' : 'closed',
    })
    if (out.length >= limit) break
  }
  return out
}

// ── Lifecycle numbers (company pages, admin) ────────────────────────────────

// SQL twin of jobLifecycle's past status: a stored reason wins; with none, past the
// freshness window at close (director and above 60 days, others 30) counts as expired.
// COALESCE: a NULL reason must read as "not expired", never as SQL NULL (NOT NULL drops the row).
const EXPIRED_SQL = Prisma.sql`COALESCE(
  o."closeReason" IN ('aged_out', 'expired')
  OR (o."closeReason" IS NULL AND o."closedAt" - COALESCE(o."postedAt", o."firstSeenAt")
      > make_interval(days => CASE WHEN o."seniorityGroup" IN ('EXECUTIVE', 'VP', 'DIRECTOR') THEN ${FRESH_DAYS_SENIOR}::int ELSE ${FRESH_DAYS_DEFAULT}::int END)),
  false
)`
const DAYS_OPEN_SQL = Prisma.sql`EXTRACT(EPOCH FROM (o."closedAt" - COALESCE(o."postedAt", o."firstSeenAt"))) / 86400.0`

export interface CompanyLifecycleStats {
  open: number
  closed: number
  expired: number
  /** Median days from posted to closed, over closed and expired jobs; null with none. */
  medianDaysOpen: number | null
  /** Roles (same title + location) posted more than once. */
  repostedRoles: number
  /** Extra postings beyond the first, across those roles. */
  reposts: number
}

export async function loadCompanyLifecycleStats(companyId: string): Promise<CompanyLifecycleStats> {
  const [row] = await prisma.$queryRaw<{ open: bigint; closed: bigint; expired: bigint; median: number | null; repostedRoles: bigint; reposts: bigint }[]>`
    WITH o AS (SELECT * FROM "CompanyJobOpening" WHERE "companyId" = ${companyId} AND "closeReason" IS DISTINCT FROM 'duplicate'),
    roles AS (
      SELECT count(*) AS n FROM o GROUP BY lower(o."title"), lower(coalesce(o."location", '')) HAVING count(*) > 1
    )
    SELECT
      count(*) FILTER (WHERE o."closedAt" IS NULL) AS open,
      count(*) FILTER (WHERE o."closedAt" IS NOT NULL AND NOT ${EXPIRED_SQL}) AS closed,
      count(*) FILTER (WHERE o."closedAt" IS NOT NULL AND ${EXPIRED_SQL}) AS expired,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY ${DAYS_OPEN_SQL}) FILTER (WHERE o."closedAt" IS NOT NULL) AS median,
      (SELECT count(*) FROM roles) AS "repostedRoles",
      (SELECT coalesce(sum(n - 1), 0) FROM roles) AS reposts
    FROM o
  `
  return {
    open: Number(row?.open ?? 0),
    closed: Number(row?.closed ?? 0),
    expired: Number(row?.expired ?? 0),
    medianDaysOpen: row?.median === null || row?.median === undefined ? null : Math.max(0, Math.round(Number(row.median))),
    repostedRoles: Number(row?.repostedRoles ?? 0),
    reposts: Number(row?.reposts ?? 0),
  }
}

export interface LifecycleWeek {
  week: string
  opened: number
  closed: number
  expired: number
}

export interface TimeToCloseRow {
  key: string
  closedJobs: number
  medianDays: number
}

export interface MarketLifecycle {
  weeks: LifecycleWeek[]
  byFunction: TimeToCloseRow[]
  byLevel: TimeToCloseRow[]
  roles: number
  repostedRoles: number
  totals: { open: number; closed: number; expired: number }
}

function weekSeries(rows: { week: Date; kind: string; n: bigint }[]): LifecycleWeek[] {
  const byWeek = new Map<string, LifecycleWeek>()
  for (const r of rows) {
    const week = r.week.toISOString().slice(0, 10)
    const w = byWeek.get(week) ?? { week, opened: 0, closed: 0, expired: 0 }
    if (r.kind === 'opened' || r.kind === 'closed' || r.kind === 'expired') w[r.kind] += Number(r.n)
    byWeek.set(week, w)
  }
  return [...byWeek.values()].sort((a, b) => a.week.localeCompare(b.week))
}

/**
 * Market-wide lifecycle (admin): openings opened vs closed per week, median time to
 * close by function and by seniority, and the repost rate. Three aggregate queries
 * over CompanyJobOpening (a few hundred thousand rows), run on the admin page only.
 */
export async function loadMarketLifecycle(weeks = 12): Promise<MarketLifecycle> {
  const since = new Date(Date.now() - weeks * 7 * 86_400_000)
  const [weekRows, fnRows, lvlRows, repost, totals] = await Promise.all([
    prisma.$queryRaw<{ week: Date; kind: string; n: bigint }[]>`
      SELECT date_trunc('week', o."firstSeenAt") AS week, 'opened' AS kind, count(*) AS n
      FROM "CompanyJobOpening" o WHERE o."firstSeenAt" >= ${since} GROUP BY 1
      UNION ALL
      SELECT date_trunc('week', o."closedAt") AS week, CASE WHEN ${EXPIRED_SQL} THEN 'expired' ELSE 'closed' END AS kind, count(*) AS n
      FROM "CompanyJobOpening" o WHERE o."closedAt" >= ${since} AND o."closeReason" IS DISTINCT FROM 'duplicate' GROUP BY 1, 2
    `,
    prisma.$queryRaw<{ key: string | null; n: bigint; median: number }[]>`
      SELECT o."function" AS key, count(*) AS n, percentile_cont(0.5) WITHIN GROUP (ORDER BY ${DAYS_OPEN_SQL}) AS median
      FROM "CompanyJobOpening" o WHERE o."closedAt" IS NOT NULL AND o."closeReason" IS DISTINCT FROM 'duplicate' AND NOT ${EXPIRED_SQL}
      GROUP BY 1 HAVING count(*) >= 20 ORDER BY 2 DESC LIMIT 20
    `,
    prisma.$queryRaw<{ key: string | null; n: bigint; median: number }[]>`
      SELECT o."seniorityGroup" AS key, count(*) AS n, percentile_cont(0.5) WITHIN GROUP (ORDER BY ${DAYS_OPEN_SQL}) AS median
      FROM "CompanyJobOpening" o WHERE o."closedAt" IS NOT NULL AND o."closeReason" IS DISTINCT FROM 'duplicate' AND NOT ${EXPIRED_SQL}
      GROUP BY 1 ORDER BY 2 DESC
    `,
    prisma.$queryRaw<{ roles: bigint; reposted: bigint }[]>`
      SELECT count(*) AS roles, count(*) FILTER (WHERE n > 1) AS reposted
      FROM (SELECT count(*) AS n FROM "CompanyJobOpening" WHERE "closeReason" IS DISTINCT FROM 'duplicate' GROUP BY "companyId", lower("title"), lower(coalesce("location", ''))) g
    `,
    prisma.$queryRaw<{ open: bigint; closed: bigint; expired: bigint }[]>`
      SELECT count(*) FILTER (WHERE o."closedAt" IS NULL) AS open,
             count(*) FILTER (WHERE o."closedAt" IS NOT NULL AND NOT ${EXPIRED_SQL}) AS closed,
             count(*) FILTER (WHERE o."closedAt" IS NOT NULL AND ${EXPIRED_SQL}) AS expired
      FROM "CompanyJobOpening" o WHERE o."closeReason" IS DISTINCT FROM 'duplicate'
    `,
  ])
  const ttc = (rows: { key: string | null; n: bigint; median: number }[]): TimeToCloseRow[] =>
    rows.map((r) => ({ key: r.key ?? 'Unknown', closedJobs: Number(r.n), medianDays: Math.max(0, Math.round(Number(r.median))) }))
  return {
    weeks: weekSeries(weekRows),
    byFunction: ttc(fnRows),
    byLevel: ttc(lvlRows),
    roles: Number(repost[0]?.roles ?? 0),
    repostedRoles: Number(repost[0]?.reposted ?? 0),
    totals: { open: Number(totals[0]?.open ?? 0), closed: Number(totals[0]?.closed ?? 0), expired: Number(totals[0]?.expired ?? 0) },
  }
}
