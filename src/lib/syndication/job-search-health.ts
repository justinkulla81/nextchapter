import 'server-only'
import { prisma } from '@/lib/prisma'
import { retryOnPoolTimeout } from '@/lib/db/heavy'
import {
  PUBLIC_JOB_MIN_INDEX_DESCRIPTION,
  PUBLIC_JOB_SITEMAP_SHARDS,
  PUBLIC_JOB_VERIFIED_DAYS,
  jobPostingJsonLd,
  missingRequiredJobFields,
} from '@/lib/jobs/public-job-page'
import { PUBLIC_JOB_LIVE_SQL, PUBLIC_JOB_OFFERED_SQL, PUBLIC_JOB_STATIC_SQL, publicJobIdsInShard, publicJobRowsByIds } from '@/lib/jobs/public-job-page-server'
import { sitemapProblems, type SitemapProblems } from '@/lib/google/search-console'
import { readJsonGz, STATE_BUCKET, writeJsonGz } from '@/lib/syndication/storage'

// The daily "are our jobs in front of Google for Jobs" numbers, shown on the admin Job health page (src/app/support/admin/(portal)/job-health).
// Computed by the indexnow-jobs cron after it sends its changes and kept as a series in storage (no table, so no prod DDL).

const SERIES_PATH = 'job-search-health/series.json.gz'
const KEEP_DAYS = 120
const SAMPLE = 400

export interface JobSearchHealth {
  day: string
  /** Approved, open, not past its expiry: what the board counts. */
  liveJobs: number
  /** Of those, confirmed open by the crawl within PUBLIC_JOB_VERIFIED_DAYS. */
  verifiedInWindow: number
  /** Jobs with a public page (the allowlist). */
  publicPages: number
  /** Public pages with the posting's own text (indexable, listed in a job sitemap and sent to IndexNow). */
  inSitemap: number
  /** Public pages kept out of search because the description is a snippet. */
  thinNoindex: number
  /** The subset the Google Indexing API push takes (stated pay, entry-level, no experience). */
  offeredToGoogleApi: number
  /** Public pages that state pay with a unit, and how many of those emit baseSalary. */
  payStated: number
  /** A sample of indexable pages run through the real JSON-LD builder and the required-field check. */
  schemaSampled: number
  schemaValid: number
  schemaMissing: Record<string, number>
  /** Google's own read of the job sitemaps, when the connected Search Console grant allows it. */
  searchConsole: SitemapProblems | { unavailable: string }
}

export const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0)

async function counts() {
  const rows = await retryOnPoolTimeout(() =>
    prisma.$queryRaw<Record<string, bigint>[]>`
      SELECT
        count(*) FILTER (WHERE status = 'approved' AND "archivedAt" IS NULL AND "closeReason" IS NULL AND ("expiresAt" IS NULL OR "expiresAt" > now())) AS live,
        count(*) FILTER (WHERE status = 'approved' AND "archivedAt" IS NULL AND "closeReason" IS NULL AND ("expiresAt" IS NULL OR "expiresAt" > now())
          AND "lastVerifiedAt" > now() - make_interval(days => ${PUBLIC_JOB_VERIFIED_DAYS}::int)) AS verified,
        count(*) FILTER (WHERE ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL}) AS public_pages,
        count(*) FILTER (WHERE ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL} AND octet_length(description) >= ${PUBLIC_JOB_MIN_INDEX_DESCRIPTION}) AS in_sitemap,
        count(*) FILTER (WHERE ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL} AND octet_length(description) >= ${PUBLIC_JOB_MIN_INDEX_DESCRIPTION} AND ${PUBLIC_JOB_OFFERED_SQL}) AS offered,
        count(*) FILTER (WHERE ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL} AND ("salaryMin" IS NOT NULL OR "salaryMax" IS NOT NULL) AND "payPeriod" IS NOT NULL) AS pay_stated
      FROM "ExclusiveJobPosting"`,
  )
  const r = rows[0]
  return {
    live: Number(r.live),
    verified: Number(r.verified),
    publicPages: Number(r.public_pages),
    inSitemap: Number(r.in_sitemap),
    offered: Number(r.offered),
    payStated: Number(r.pay_stated),
  }
}

/** Runs a sample of one shard's indexable pages (a different shard each day) through the builder the page uses. */
async function schemaSample(day: string) {
  const shard = Math.floor(Date.parse(day) / 86_400_000) % PUBLIC_JOB_SITEMAP_SHARDS
  const ids = (await publicJobIdsInShard(shard)).map((r) => r.id)
  const pick = ids.filter((_, i) => i % Math.max(1, Math.floor(ids.length / SAMPLE)) === 0).slice(0, SAMPLE)
  const rows = await publicJobRowsByIds(pick)
  const missing: Record<string, number> = {}
  let valid = 0
  for (const row of rows) {
    const gaps = missingRequiredJobFields(jobPostingJsonLd(row))
    if (gaps.length === 0) valid++
    for (const g of gaps) missing[g] = (missing[g] ?? 0) + 1
  }
  return { sampled: rows.length, valid, missing }
}

export async function computeJobSearchHealth(now = new Date()): Promise<JobSearchHealth> {
  const day = now.toISOString().slice(0, 10)
  const [c, sample, searchConsole] = await Promise.all([
    counts(),
    schemaSample(day),
    sitemapProblems().catch((e) => ({ unavailable: e instanceof Error ? e.message : String(e) })),
  ])
  return {
    day,
    liveJobs: c.live,
    verifiedInWindow: c.verified,
    publicPages: c.publicPages,
    inSitemap: c.inSitemap,
    thinNoindex: c.publicPages - c.inSitemap,
    offeredToGoogleApi: c.offered,
    payStated: c.payStated,
    schemaSampled: sample.sampled,
    schemaValid: sample.valid,
    schemaMissing: sample.missing,
    searchConsole,
  }
}

export async function readJobSearchHealth(): Promise<JobSearchHealth[]> {
  return (await readJsonGz<JobSearchHealth[]>(STATE_BUCKET, SERIES_PATH)) ?? []
}

/** Today's numbers, appended to the series (one entry a day, the last run of the day wins). */
export async function recordJobSearchHealth(): Promise<JobSearchHealth> {
  const today = await computeJobSearchHealth()
  const series = (await readJobSearchHealth()).filter((h) => h.day !== today.day)
  series.push(today)
  await writeJsonGz(STATE_BUCKET, SERIES_PATH, series.slice(-KEEP_DAYS))
  return today
}

