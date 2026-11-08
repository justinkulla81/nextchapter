import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getTitleDetail, type TitleJob } from '@/lib/seo/job-titles'
import { baseTitle, titleSlug } from '@/lib/seo/job-title-rules'
import { memoTtl, retryOnPoolTimeout, sharedLoad } from '@/lib/db/heavy'
import { withStatementTimeout } from '@/lib/db/statement-timeout'
import { getConfirmedGhostIds } from '@/lib/jobs/job-dismiss-server'
import {
  PUBLIC_JOB_GHOST_AGE_DAYS,
  PUBLIC_JOB_MIN_DESCRIPTION,
  PUBLIC_JOB_MIN_INDEX_DESCRIPTION,
  PUBLIC_JOB_SITEMAP_SHARDS,
  PUBLIC_JOB_SOURCES,
  PUBLIC_JOB_VERIFIED_DAYS,
  cleanCompanyText,
  isPublicJob,
  isViewableJob,
  type PublicJobRow,
} from '@/lib/jobs/public-job-page'

// Database side of the public job pages (rules: public-job-page.ts).

export const PUBLIC_JOB_SELECT = {
  id: true,
  title: true,
  companyName: true,
  location: true,
  description: true,
  url: true,
  status: true,
  archivedAt: true,
  closeReason: true,
  expiresAt: true,
  lastVerifiedAt: true,
  createdAt: true,
  postedAt: true,
  disclosure: true,
  distribution: true,
  institutionScopeId: true,
  orgScopeId: true,
  source: true,
  employmentType: true,
  locationCountry: true,
  locationState: true,
  locationCity: true,
  workArrangement: true,
  reopenCount: true,
  repostCount: true,
  directListing: true,
  sourceCategory: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  payPeriod: true,
  postingSignals: true,
  noExperiencePhrase: true,
  trainingPhrase: true,
  externalJobId: true,
  requisitionId: true,
  company: { select: { website: true } },
} satisfies Prisma.ExclusiveJobPostingSelect

/** PUBLIC_JOB_SELECT without the posting text: a list that never shows it should not pull it (about 2 KB a row). */
const { description: _description, ...listSelect } = PUBLIC_JOB_SELECT
export const PUBLIC_JOB_LIST_SELECT = listSelect

/**
 * Puts back just enough of each posting's text for isPublicJob's length check (the first PUBLIC_JOB_MIN_DESCRIPTION characters),
 * so a list of 60 jobs reads a few KB of text instead of 120 KB.
 */
export async function withDescriptionStubs<T extends { id: string }>(rows: T[]): Promise<(T & { description: string | null })[]> {
  if (!rows.length) return []
  const stubs = await prisma.$queryRaw<{ id: string; d: string | null }[]>(
    Prisma.sql`SELECT id, left(description, ${PUBLIC_JOB_MIN_DESCRIPTION}::int) AS d FROM "ExclusiveJobPosting" WHERE id IN (${Prisma.join(rows.map((r) => r.id))})`
  )
  const byId = new Map(stubs.map((x) => [x.id, x.d]))
  return rows.map((r) => ({ ...r, description: byId.get(r.id) ?? null }))
}

/** The job, or null when it has no public page (closed, private, not verified…). One primary-key read. */
export async function getPublicJob(id: string): Promise<PublicJobRow | null> {
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return null
  const [job, ghosts] = await Promise.all([
    retryOnPoolTimeout(() => prisma.exclusiveJobPosting.findUnique({ where: { id }, select: PUBLIC_JOB_SELECT })),
    retryOnPoolTimeout(() => getConfirmedGhostIds()),
  ])
  if (!job || !isViewableJob(job, Date.now(), ghosts.has(job.id))) return null
  return { ...job, companyName: cleanCompanyText(job.companyName) }
}

// The allowlist's fixed rules — IDENTICAL to the WHERE of the partial index
// "ExclusiveJobPosting_public_page_shard_idx" (prisma/manual/2026-10-22-public-job-pages.sql),
// or the planner won't use it.
export const PUBLIC_JOB_STATIC_SQL = Prisma.sql`
  status = 'approved'
  AND "archivedAt" IS NULL
  AND "closeReason" IS NULL
  AND disclosure = 'OPEN'
  AND distribution = 'OPEN'
  AND "institutionScopeId" IS NULL
  AND "orgScopeId" IS NULL
  AND source IN ('ats_feed', 'admin', 'employer', 'recruiter')
  AND length(description) >= 200
  AND ("employmentType" IS NULL OR "employmentType" NOT IN ('internship', 'co_op', 'coop'))
  AND title !~* '\\m(intern|interns|internships?|student trainee)\\M'
  AND ("locationCountry" = 'US' OR ("locationCountry" IS NULL AND "locationState" IS NOT NULL))
  AND COALESCE("reopenCount", 0) < 2
  AND COALESCE("repostCount", 0) < 2`

// The time-dependent rules, applied on top of the index.
export const PUBLIC_JOB_LIVE_SQL = Prisma.sql`
  "lastVerifiedAt" > now() - make_interval(days => ${PUBLIC_JOB_VERIFIED_DAYS}::int)
  AND ("expiresAt" IS NULL OR "expiresAt" > now())
  AND ("createdAt" > now() - make_interval(days => ${PUBLIC_JOB_GHOST_AGE_DAYS}::int)
       OR ("directListing" AND COALESCE("reopenCount", 0) = 0 AND COALESCE("repostCount", 0) = 0))
  AND NOT EXISTS (
    SELECT 1 FROM "JobPostingFlag" f WHERE f."postingId" = "ExclusiveJobPosting".id AND f."adminDecision" = 'confirmed_ghost'
  )`

/**
 * The jobs we ask search engines to take (the sitemap and the pushes to Google and Bing), a smaller set than every public job:
 * the ones that state pay (Google for Jobs shows pay) or are entry-level or need no experience. Every other public job keeps
 * its page and is still found through links; it is just not offered. On 2026-10-26 that was about 45,000 of 176,000 live jobs.
 */
export const PUBLIC_JOB_OFFERED_SQL = Prisma.sql`(
  ("salaryMin" IS NOT NULL AND "payPeriod" IN ('year', 'hour'))
  OR level = 'ENTRY_IC'
  OR 'no_experience_ok' = ANY("postingSignals")
)`

/**
 * The jobs offered to search engines (sitemap, Google Indexing API, IndexNow) must be on the employer's own career system.
 * Jobs linked through an aggregator such as Jooble keep their page for members but are noindex (isIndexableJob) and are
 * reported to Google and Bing as removed (owner decision, 2026-11-04).
 */
export const PUBLIC_JOB_SEARCH_SQL = Prisma.sql`("directListing" IS TRUE OR "sourceCategory" = 'employer')`

/**
 * Feed jobs in shard `shard` (0–15): the public allowlist, listed on the employer's own career system (directListing),
 * never hourly pay. For the aggregator feeds (src/lib/syndication/job-feed-server.ts).
 */
export async function feedJobIdsInShard(shard: number): Promise<{ id: string }[]> {
  if (!Number.isInteger(shard) || shard < 0 || shard >= PUBLIC_JOB_SITEMAP_SHARDS) return []
  return prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "ExclusiveJobPosting"
    WHERE ${PUBLIC_JOB_STATIC_SQL}
      AND (hashtext(id) & 15) = ${shard}::int
      AND ${PUBLIC_JOB_LIVE_SQL}
      AND "directListing"
      AND ("payPeriod" IS NULL OR "payPeriod" <> 'hour')
    ORDER BY id`
}

/**
 * One job sitemap file: every public job in shard `shard` (0–15) whose page is indexable (the posting's own text, 1,500+ bytes), with
 * its last verification. Not narrowed to PUBLIC_JOB_OFFERED_SQL: Google for Jobs lists any complete posting, pay stated or not, and
 * Indeed-style coverage means offering all of them. The Indexing API push (200 a day) stays on the offered set.
 */
export async function publicJobsInShard(shard: number): Promise<{ id: string; lastVerifiedAt: Date }[]> {
  if (!Number.isInteger(shard) || shard < 0 || shard >= PUBLIC_JOB_SITEMAP_SHARDS) return []
  return prisma.$queryRaw<{ id: string; lastVerifiedAt: Date }[]>`
    SELECT id, "lastVerifiedAt" FROM "ExclusiveJobPosting"
    WHERE ${PUBLIC_JOB_STATIC_SQL}
      AND (hashtext(id) & 15) = ${shard}::int
      AND ${PUBLIC_JOB_SEARCH_SQL}
      AND octet_length(description) >= ${PUBLIC_JOB_MIN_INDEX_DESCRIPTION}
      AND ${PUBLIC_JOB_LIVE_SQL}
    ORDER BY id
    LIMIT 50000`
}

/**
 * Every public job (the page allowlist) in shard `shard` (0–15) with its dates — the syndication crons' (src/lib/syndication)
 * view of it. `offered` says whether it is also one we ask search engines to take; a job that is public but not offered must
 * never be reported to a search engine as gone.
 */
export async function publicJobIdsInShard(shard: number): Promise<{ id: string; createdAt: Date; postedAt: Date | null; offered: boolean; value: number }[]> {
  if (!Number.isInteger(shard) || shard < 0 || shard >= PUBLIC_JOB_SITEMAP_SHARDS) return []
  // value: stated pay and an employer-system listing, the part of googleJobPriority that comes from the row (src/lib/syndication/syndication.ts).
  return prisma.$queryRaw<{ id: string; createdAt: Date; postedAt: Date | null; offered: boolean; value: number }[]>`
    SELECT id, "createdAt", "postedAt", ${PUBLIC_JOB_OFFERED_SQL} AS offered,
      (CASE WHEN "salaryMin" IS NOT NULL AND "payPeriod" = 'year' THEN 3 WHEN "salaryMin" IS NOT NULL AND "payPeriod" = 'hour' THEN 1 ELSE 0 END
        + CASE WHEN "directListing" THEN 2 ELSE 0 END)::int AS value FROM "ExclusiveJobPosting"
    WHERE ${PUBLIC_JOB_STATIC_SQL}
      AND (hashtext(id) & 15) = ${shard}::int
      AND ${PUBLIC_JOB_SEARCH_SQL}
      AND octet_length(description) >= ${PUBLIC_JOB_MIN_INDEX_DESCRIPTION}
      AND ${PUBLIC_JOB_LIVE_SQL}
    ORDER BY id`
}

/**
 * Full rows for ids from publicJobIdsInShard, re-checked against the allowlist (a job can
 * close between the two reads). The confirmed-ghost rule was already applied in SQL.
 */
export async function publicJobRowsByIds(ids: string[]): Promise<PublicJobRow[]> {
  if (ids.length === 0) return []
  const rows = await prisma.exclusiveJobPosting.findMany({ where: { id: { in: ids } }, select: PUBLIC_JOB_SELECT })
  const now = Date.now()
  return rows.filter((r) => isPublicJob(r, now))
}

export interface SimilarJob {
  id: string
  title: string
  locationCity: string | null
  locationState: string | null
}

/**
 * Other open roles at the same employer, for the "More roles at this employer" links on a public job page. Same rules as the
 * sitemap (an indexable, live, employer-system listing), so a link never points at a page that is kept out of search.
 * Filtered on companyId (indexed), so it reads only that employer's rows. A failed read returns an empty list.
 */
export async function similarJobsAtCompany(companyId: string | null | undefined, excludeId: string, limit = 6): Promise<SimilarJob[]> {
  if (!companyId) return []
  try {
    // The page's own job is dropped here, after the read, so one read serves every job page of the employer.
    const rows = (await employerRoles(companyId)).filter((r) => r.id !== excludeId)
    return pickSimilarJobs(rows, limit)
  } catch {
    return []
  }
}

// How many rows one cached read keeps: the most any caller asks for (6 links, three candidates each) plus the page's own job.
const SIMILAR_CACHED_ROWS = 25

/**
 * An employer's newest public roles, read once and shared. Every job page of the employer used to run this query again, and a crawl
 * makes hundreds of thousands of such page views a day (351k reads between 2026-11-06 and 11-07), which was a large share of the
 * database's disk reads and outbound data (Supabase Disk IO and egress warnings). Kept on the instance for ten minutes and in the
 * shared data cache for an hour; a failed or slow read throws, so it is never stored.
 */
const employerRoles = memoTtl(10 * 60_000, (companyId: string) => companyId, (companyId: string) =>
  sharedLoad(`similar-at-company:${companyId}`, 3600, () => loadEmployerRoles(companyId), { reviveDates: false }))

async function loadEmployerRoles(companyId: string): Promise<SimilarJob[]> {
  // The employer's newest rows by cheap columns first (no description read), then the full public rules on only those.
  // A large employer has ~10,000 open rows; running the description checks and regexes on all of them took 2-7 s each
  // view and slowed every member page on the shared database (2026-11-05).
  return withStatementTimeout(
    prisma.$queryRaw<SimilarJob[]>`
      WITH recent AS MATERIALIZED (
        SELECT id FROM "ExclusiveJobPosting"
        WHERE "companyId" = ${companyId}
          AND status = 'approved' AND "archivedAt" IS NULL AND "closeReason" IS NULL
        ORDER BY "lastVerifiedAt" DESC
        LIMIT 150
      )
      SELECT id, title, "locationCity", "locationState" FROM "ExclusiveJobPosting"
      WHERE id IN (SELECT id FROM recent)
        AND ${PUBLIC_JOB_STATIC_SQL}
        AND ${PUBLIC_JOB_SEARCH_SQL}
        AND octet_length(description) >= ${PUBLIC_JOB_MIN_INDEX_DESCRIPTION}
        AND ${PUBLIC_JOB_LIVE_SQL}
      ORDER BY "lastVerifiedAt" DESC
      LIMIT ${SIMILAR_CACHED_ROWS}`,
    3_000
  )
}

/** One link per distinct title and place, so a company that posts the same role in ten offices does not fill the block. */
export function pickSimilarJobs(rows: SimilarJob[], limit: number): SimilarJob[] {
  const seen = new Set<string>()
  const out: SimilarJob[] = []
  for (const r of rows) {
    const key = `${r.title.trim().toLowerCase()}|${r.locationCity ?? ''}|${r.locationState ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
    if (out.length >= limit) break
  }
  return out
}

export interface LikeJob { id: string; title: string; companyName: string; locationCity: string | null; locationState: string | null }

interface LikeKey { socCode: string | null; targetFunction: string | null; level: string | null }
type LikeRow = LikeJob & { companyId: string | null; direct: boolean }
// The most rows one read keeps: the occupation's newest 200 (or the function's 300) that pass the public rules.
const SIMILAR_LIKE_CACHED_ROWS = 300

/**
 * The candidates behind similarJobsLike, read once per occupation (or per function and level) and shared. Job pages ran this query on every
 * view: 80,000 reads in the 7.5 hours to 2026-11-07 22:48 UTC, the largest reader of the database's disk (Supabase Disk IO warning). The
 * key holds only the occupation: the page's state, its own job and its own employer are applied after the read (similarJobsLike), because
 * a key per state and employer is a key a crawl never repeats. Kept on the instance for ten minutes and in the shared data cache for an
 * hour; a failed or slow read throws, so it is never stored.
 */
const likeRoles = memoTtl(10 * 60_000, (k: LikeKey) => JSON.stringify(k), (k: LikeKey) =>
  sharedLoad(`similar-like-v2:${JSON.stringify(k)}`, 3600, () => loadLikeRoles(k), { reviveDates: false }))

async function loadLikeRoles(job: LikeKey): Promise<LikeRow[]> {
  // About 28% of live jobs carry no occupation code (the feed did not send one). Those match on function and level instead, read from the
  // board's narrow copy (BoardLightRow, ~0.5 s; the wide table has no index on function and took over 8 s), newest first.
  const byCode = !!job.socCode
  const recent = byCode
    ? Prisma.sql`SELECT id FROM "ExclusiveJobPosting"
        WHERE "socCode" = ${job.socCode}
          AND status = 'approved' AND "archivedAt" IS NULL AND "closeReason" IS NULL
        ORDER BY "lastVerifiedAt" DESC NULLS LAST
        LIMIT 200`
    : Prisma.sql`SELECT id FROM "BoardLightRow"
        WHERE "targetFunction" = ${job.targetFunction}
          ${job.level ? Prisma.sql`AND level = ${job.level}` : Prisma.empty}
          AND status = 'approved' AND "archivedAt" IS NULL
        ORDER BY "postedAt" DESC NULLS LAST
        LIMIT 300`
  return withStatementTimeout(
    prisma.$queryRaw<LikeRow[]>`
      WITH recent AS MATERIALIZED (${recent})
      SELECT id, title, "companyName", "locationCity", "locationState", "companyId",
             ("directListing" OR "sourceCategory" = 'employer') AS direct FROM "ExclusiveJobPosting"
      WHERE id IN (SELECT id FROM recent)
        AND ${PUBLIC_JOB_STATIC_SQL}
        AND ${PUBLIC_JOB_LIVE_SQL}
      ORDER BY "lastVerifiedAt" DESC
      LIMIT ${SIMILAR_LIKE_CACHED_ROWS}`,
    3_000,
  )
}

/**
 * Open jobs like one: the same occupation (SOC code, which is indexed), in the same state first, employers on their own career system
 * first, newest first, at most two per employer. Reads only the occupation's newest rows by cheap columns, then applies the full public
 * rules to those (the same shape as similarJobsAtCompany, because the occupation's rows number in the thousands). `excludeCompanyId` leaves
 * out the employer a page already lists on its own. A failed or slow read (3 seconds) gives none.
 */
export async function similarJobsLike(job: { id: string; socCode: string | null | undefined; targetFunction?: string | null; level?: string | null; locationState: string | null | undefined; excludeCompanyId?: string | null }, limit = 6): Promise<LikeJob[]> {
  const byCode = !!job.socCode
  if (!byCode && !job.targetFunction) return []
  try {
    const read = await likeRoles({ socCode: job.socCode ?? null, targetFunction: job.targetFunction ?? null, level: job.level ?? null })
    // The page's own job and employer are dropped here, after the read, so one read serves every job page with the same occupation.
    const state = job.locationState ?? null
    const sameState = (r: LikeRow) => (r.locationState ?? null) === state
    // Same order as the query had: this state first, then employer-system listings, then newest (the read is already newest first and direct-flagged, and sort is stable).
    const rows = read
      .filter((r) => r.id !== job.id && !(job.excludeCompanyId && r.companyId === job.excludeCompanyId))
      .sort((a, b) => Number(sameState(b)) - Number(sameState(a)) || Number(b.direct) - Number(a.direct))
    const perCompany = new Map<string, number>()
    const seen = new Set<string>()
    const out: LikeJob[] = []
    for (const r of rows) {
      const company = cleanCompanyText(r.companyName)
      const key = `${company}|${r.title.trim().toLowerCase()}|${r.locationCity ?? ''}`
      if (seen.has(key) || (perCompany.get(company) ?? 0) >= 2) continue
      seen.add(key)
      perCompany.set(company, (perCompany.get(company) ?? 0) + 1)
      out.push({ id: r.id, title: r.title, companyName: company, locationCity: r.locationCity, locationState: r.locationState })
      if (out.length >= limit) break
    }
    return out
  } catch {
    return []
  }
}

/** What a job page with no live listing can say: what the job was, the same title open elsewhere, and the employer's other open roles. Null when no such id exists. */
export async function getClosedJobContext(id: string): Promise<{ title: string; companyName: string; place: string | null; similar: SimilarJob[]; sameTitle: TitleJob[] } | null> {
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return null
  try {
    const row = await prisma.exclusiveJobPosting.findUnique({ where: { id }, select: { title: true, companyName: true, disclosure: true, companyId: true, locationCity: true, locationState: true, location: true, socCode: true, targetFunction: true, level: true } })
    if (!row) return null
    const confidential = row.disclosure !== 'OPEN'
    const [similar, detail] = await Promise.all([
      confidential ? Promise.resolve([]) : similarJobsAtCompany(row.companyId, id),
      // The title's own page figures (stored, cheap): the newest open jobs with this title anywhere. Titles too rare for a page give none.
      getTitleDetail(titleSlug(baseTitle(row.title))).catch(() => null),
    ])
    return {
      title: row.title,
      companyName: confidential ? '' : cleanCompanyText(row.companyName),
      place: row.locationCity && row.locationState ? `${row.locationCity}, ${row.locationState}` : row.location || row.locationState,
      similar,
      sameTitle: await sameTitleOrLikeIt((detail?.jobs ?? []).filter((j) => j.id !== id).slice(0, 8), { id, socCode: row.socCode, targetFunction: row.targetFunction, level: row.level, locationState: row.locationState }),
    }
  } catch {
    return null
  }
}

/** The same title's open jobs when its page has any; otherwise (a rare title) open jobs in the same occupation (similarJobsLike). */
async function sameTitleOrLikeIt(sameTitle: TitleJob[], job: { id: string; socCode: string | null; targetFunction: string | null; level: string | null; locationState: string | null }): Promise<TitleJob[]> {
  if (sameTitle.length > 0) return sameTitle
  const like = await similarJobsLike(job)
  return like.map((j) => ({ id: j.id, title: j.title, company: j.companyName, location: j.locationCity && j.locationState ? `${j.locationCity}, ${j.locationState}` : j.locationState, postedAt: '', pay: null }))
}
