import 'server-only'
import { unstable_cache } from 'next/cache'
import { heavy, memoTtl } from '@/lib/db/heavy'
import { readBoardFigure } from '@/lib/jobs/stored-board-figures'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PUBLIC_JOB_SELECT } from '@/lib/jobs/public-job-page-server'
import { getConfirmedGhostIds } from '@/lib/jobs/job-dismiss-server'
import { isPublicJob } from '@/lib/jobs/public-job-page'
import { stateName, stateSlug } from '@/lib/seo/states'
import { STATE_NAMES } from '@/lib/workforce/places'
import { TITLE_MIN_JOBS, TITLE_MIN_PAY, displayTitle, titleSlug, GENERIC_TITLES } from '@/lib/seo/job-title-rules'
import { modalFunction } from '@/lib/pay/ai-premium'

// Data for the salary pages (/salaries/<title>) and the job-title pages (/jobs/title/<title>), and the job-type pages
// (/jobs/type/<type>). Everything comes from the open public job listings: the same rows the job board shows, counted
// with the cheap half of the allowlist (src/lib/seo/topic-data.ts explains why) and listed only after the full rule.
// Pay is what the listing states, annualized (hourly x 2,080 hours); listings without pay are left out of the numbers.
//
// One scan feeds every page: it reads the open listings once (id, cleaned title, state, employer, date, pay, type), and the
// title index, each title's page and each job type's page are worked out from that in memory. The scan is kept for six hours
// on an instance and shared by every request that arrives meanwhile. A scan per page, as this first did, took minutes under
// crawl load and hit the database's statement timeout.

const PUBLIC = Prisma.sql`status = 'approved' AND "archivedAt" IS NULL AND "closeReason" IS NULL AND disclosure = 'OPEN' AND distribution = 'OPEN'
  AND "institutionScopeId" IS NULL AND "orgScopeId" IS NULL AND "lastVerifiedAt" > now() - interval '7 days'
  AND source IN ('ats_feed', 'admin', 'employer', 'recruiter')
  AND ("employmentType" IS NULL OR "employmentType" NOT IN ('internship', 'co_op', 'coop'))
  AND title !~* '\\m(intern|interns|internships?|student trainee)\\M'
  AND ("locationCountry" = 'US' OR ("locationCountry" IS NULL AND "locationState" IS NOT NULL))`

// A title with the "- Team", ", Team" and "(Remote)" tails cut off, lower-cased. Seniority words stay: a senior engineer
// and an engineer are different salary pages.
const BASE = Prisma.sql`lower(btrim(regexp_replace(regexp_replace(regexp_replace(title, '[[:space:]]+[-–—|][[:space:]]+.*$', ''), '[[:space:]]*[,(:/].*$', ''), '[[:space:]]+', ' ', 'g')))`

// Annualized midpoint of the stated pay, or null when the listing does not state a usable annual figure.
const PAY = Prisma.sql`CASE
  WHEN "salaryMin" IS NULL THEN NULL
  WHEN "payPeriod" = 'year' AND "salaryMin" BETWEEN 25000 AND 1500000 AND COALESCE("salaryMax", "salaryMin") BETWEEN "salaryMin" AND "salaryMin" * 3 THEN ("salaryMin" + COALESCE("salaryMax", "salaryMin")) / 2.0
  WHEN "payPeriod" = 'hour' AND "salaryMin" * 2080 BETWEEN 25000 AND 400000 AND COALESCE("salaryMax", "salaryMin") BETWEEN "salaryMin" AND "salaryMin" * 3 THEN ("salaryMin" + COALESCE("salaryMax", "salaryMin")) / 2.0 * 2080
  ELSE NULL END`

export interface TitleStat {
  slug: string
  base: string
  name: string
  jobs: number
  payCount: number
  p25: number | null
  median: number | null
  p75: number | null
  /** The function (crawler code) most of this title's listings are tagged with, when there is a clear majority: where its AI-skill premium comes from (src/lib/pay/ai-premium.ts). */
  fn?: string | null
}

export interface TitleJob { id: string; title: string; company: string; location: string | null; postedAt: string; pay: string | null }
export interface TitleDetail {
  stat: TitleStat
  jobs: TitleJob[]
  states: { code: string; name: string; slug: string; jobs: number; median: number | null; payCount: number }[]
  employers: { name: string; jobs: number }[]
  related: TitleStat[]
}

export interface JobType { slug: string; name: string; noun: string }
export const JOB_TYPES: JobType[] = [
  { slug: 'remote', name: 'Remote', noun: 'remote' },
  { slug: 'hybrid', name: 'Hybrid', noun: 'hybrid' },
  { slug: 'contract', name: 'Contract', noun: 'contract' },
  { slug: 'part-time', name: 'Part-time', noun: 'part-time' },
  { slug: 'interim', name: 'Interim', noun: 'interim' },
]
export const jobTypeBySlug = (slug: string) => JOB_TYPES.find((t) => t.slug === slug)

export interface JobTypeDetail { type: JobType; total: number; jobs: TitleJob[]; titles: TitleStat[]; states: { code: string; name: string; slug: string; jobs: number }[]; medianPay: number | null; payCount: number }

const round = (n: number | null) => (n == null ? null : Math.round(n / 500) * 500)

/** Linear-interpolated percentile of a sorted list, the same as SQL percentile_cont. */
function percentile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

interface ScanRow { id: string; b: string; state: string | null; company: string; posted: Date; pay: number | null; fn: string | null }

export interface TypeSummary { total: number; payCount: number; median: number | null; states: { st: string; n: number }[]; ids: string[]; bases: string[] }

interface Dataset {
  stats: TitleStat[]
  rowsByBase: Map<string, ScanRow[]>
  types: Map<string, TypeSummary>
}

/** One pass over the open board (25-50 s). Run by the cron /api/cron/board-figures (buildTitleFigures), not by a page. */
async function scan(): Promise<Dataset> {
  // Titles with enough listings are picked in the same query, so only their rows come back.
  const rowsQuery = prisma.$queryRaw<{ id: string; b: string; state: string | null; company: string; posted: Date; pay: number | null; fn: string | null }[]>`
    WITH t AS (
      SELECT id, ${BASE} AS b, "locationState" AS state, "companyName" AS company, COALESCE("postedAt", "createdAt") AS posted, ${PAY} AS pay, "targetFunction" AS fn
      FROM "ExclusiveJobPosting" WHERE ${PUBLIC}
    ), c AS (SELECT b FROM t WHERE length(b) BETWEEN 6 AND 60 AND b !~ '[0-9]' GROUP BY b HAVING count(*) >= ${TITLE_MIN_JOBS})
    SELECT t.id, t.b, t.state, t.company, t.posted, t.pay::float8 AS pay, t.fn FROM t JOIN c ON c.b = t.b`
  // Job types (remote, hybrid, contract, part-time, interim) are summed over all listings, not only those under a title page.
  const typesQuery = prisma.$queryRaw<{ ty: string; total: number; pay_n: number; med: number | null; states: { st: string; n: number }[] | null; ids: string[] | null; bases: string[] | null }[]>`
    WITH t AS (
      SELECT id, ${BASE} AS b, "locationState" AS st, COALESCE("postedAt", "createdAt") AS posted, ${PAY} AS pay,
        array_remove(ARRAY[
          CASE WHEN "workArrangement" = 'remote' THEN 'remote' END, CASE WHEN "workArrangement" = 'hybrid' THEN 'hybrid' END,
          CASE WHEN "employmentType" = 'contract' THEN 'contract' END, CASE WHEN "employmentType" = 'part_time' THEN 'part-time' END,
          CASE WHEN "employmentType" = 'interim' THEN 'interim' END], NULL) AS types
      FROM "ExclusiveJobPosting" WHERE ${PUBLIC} AND ("workArrangement" IN ('remote', 'hybrid') OR "employmentType" IN ('contract', 'part_time', 'interim'))
    ), u AS (SELECT unnest(types) AS ty, id, b, st, posted, pay FROM t)
    SELECT ty, count(*)::int AS total, count(pay)::int AS pay_n, percentile_cont(0.5) WITHIN GROUP (ORDER BY pay)::float8 AS med,
      (SELECT json_agg(x) FROM (SELECT st, count(*)::int AS n FROM u u2 WHERE u2.ty = u.ty AND u2.st IS NOT NULL GROUP BY st ORDER BY n DESC LIMIT 12) x) AS states,
      (SELECT json_agg(y.id) FROM (SELECT id FROM u u3 WHERE u3.ty = u.ty ORDER BY posted DESC LIMIT 80) y) AS ids,
      (SELECT json_agg(z.b) FROM (SELECT b FROM u u4 WHERE u4.ty = u.ty GROUP BY b ORDER BY count(*) DESC LIMIT 60) z) AS bases
    FROM u GROUP BY ty`
  const [rows, typeRows] = await Promise.all([rowsQuery, typesQuery])
  const rowsByBase = new Map<string, ScanRow[]>()
  for (const r of rows) {
    const row: ScanRow = { id: r.id, b: r.b, state: r.state, company: r.company, posted: new Date(r.posted), pay: r.pay == null ? null : Number(r.pay), fn: r.fn }
    ;(rowsByBase.get(r.b) ?? rowsByBase.set(r.b, []).get(r.b)!).push(row)
  }
  const stats: TitleStat[] = []
  const seen = new Set<string>()
  for (const [base, list] of rowsByBase) {
    if (GENERIC_TITLES.has(base)) continue
    const slug = titleSlug(base)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    const pay = list.flatMap((r) => (r.pay == null ? [] : [r.pay])).sort((a, b) => a - b)
    stats.push({ slug, base, name: displayTitle(base), jobs: list.length, payCount: pay.length, p25: round(percentile(pay, 0.25)), median: round(percentile(pay, 0.5)), p75: round(percentile(pay, 0.75)), fn: modalFunction(list.map((r) => r.fn)) })
  }
  stats.sort((a, b) => b.jobs - a.jobs)
  const types = new Map(typeRows.map((r) => [r.ty, { total: r.total, payCount: r.pay_n, median: r.med == null ? null : Number(r.med), states: r.states ?? [], ids: r.ids ?? [], bases: r.bases ?? [] }]))
  return { stats, rowsByBase, types }
}

const sharedScan = memoTtl(6 * 3600_000, () => 'scan', () => heavy(scan))

/** What one title's page needs from its listings, worked out once so the page does not need the rows. */
export interface TitleParts {
  /** The 60 newest listing ids. */
  jobIds: string[]
  states: { code: string; jobs: number; median: number | null; payCount: number }[]
  employers: { name: string; jobs: number }[]
}

function titleParts(rows: ScanRow[]): TitleParts {
  const byState = new Map<string, { jobs: number; pay: number[] }>()
  const byEmployer = new Map<string, number>()
  for (const r of rows) {
    byEmployer.set(r.company, (byEmployer.get(r.company) ?? 0) + 1)
    if (!r.state) continue
    const e = byState.get(r.state) ?? { jobs: 0, pay: [] }
    e.jobs++
    if (r.pay != null) e.pay.push(r.pay)
    byState.set(r.state, e)
  }
  return {
    jobIds: [...rows].sort((a, b) => b.posted.getTime() - a.posted.getTime()).slice(0, 60).map((r) => r.id),
    // A listing can carry a code that is not a state or DC (a territory, a typo); those have no state page.
    states: [...byState].filter(([code]) => code in STATE_NAMES).sort((a, b) => b[1].jobs - a[1].jobs).slice(0, 12).map(([code, e]) => ({ code, jobs: e.jobs, median: e.pay.length >= 8 ? round(median(e.pay)) : null, payCount: e.pay.length })),
    employers: [...byEmployer].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, jobs]) => ({ name, jobs })),
  }
}

/** Every figure the title and job-type pages read, from one scan: the title list, the job-type summaries, and each title's parts. */
export async function buildTitleFigures(): Promise<{ stats: TitleStat[]; types: [string, TypeSummary][]; parts: Map<string, TitleParts> }> {
  const data = await scan()
  const parts = new Map<string, TitleParts>()
  for (const t of data.stats) parts.set(t.slug, titleParts(data.rowsByBase.get(t.base) ?? []))
  return { stats: data.stats, types: [...data.types], parts }
}

// The scan runs in the cron /api/cron/board-figures, which stores its results (BoardFigure); these read the stored rows. The
// live scan only runs when no row exists yet, never on a normal request (it took 25-50 s and, run by many cold instances at
// once, starved the database's connection pool).
const cachedStats = unstable_cache(
  async () => (await readBoardFigure<TitleStat[]>('job-title-stats')) ?? (await sharedScan()).stats,
  ['job-title-stats-v5'],
  { revalidate: 600 },
)
const cachedTypes = unstable_cache(
  async () => (await readBoardFigure<[string, TypeSummary][]>('job-type-summaries')) ?? [...(await sharedScan()).types],
  ['job-type-summaries-v4'],
  { revalidate: 600 },
)

/** Every title with enough open listings for a page, most listings first. */
export async function getTitleIndex(): Promise<TitleStat[]> {
  return cachedStats()
}

export const hasSalaryPage = (t: TitleStat) => t.payCount >= TITLE_MIN_PAY && t.median != null && t.p25 != null && t.p75 != null

const k = (n: number) => `$${Math.round(n / 1000)}k`
function payText(min: number | null, max: number | null, period: string | null): string | null {
  if (!min || !max || period !== 'year' || max < min || min < 20_000 || max > 2_000_000) return null
  return min === max ? k(min) : `${k(min)}–${k(max)}`
}

/** The newest listings, re-checked against the full public-page rule so every one listed has a page. */
async function newestJobs(ids: string[], limit: number): Promise<TitleJob[]> {
  const [wide, ghosts] = await Promise.all([
    prisma.exclusiveJobPosting.findMany({ where: { id: { in: ids } }, select: PUBLIC_JOB_SELECT }),
    getConfirmedGhostIds(),
  ])
  const byId = new Map(wide.map((w) => [w.id, w]))
  const now = Date.now()
  return ids
    .flatMap((id) => {
      const w = byId.get(id)
      return w && isPublicJob(w, now, ghosts.has(w.id)) ? [w] : []
    })
    .slice(0, limit)
    .map((r) => ({ id: r.id, title: r.title, company: r.companyName, location: r.location, postedAt: (r.postedAt ?? r.createdAt).toISOString(), pay: payText(r.salaryMin, r.salaryMax, r.payPeriod) }))
}

function median(xs: number[]): number | null {
  return percentile([...xs].sort((a, b) => a - b), 0.5)
}

/** One title's page data, or null when the title has no page. */
export async function getTitleDetail(slug: string): Promise<TitleDetail | null> {
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return null
  const stats = await getTitleIndex()
  const stat = stats.find((t) => t.slug === slug)
  if (!stat) return null
  const parts = (await readBoardFigure<TitleParts>(`job-title:${slug}`)) ?? titleParts((await sharedScan()).rowsByBase.get(stat.base) ?? [])
  const last = stat.base.split(' ').slice(-1)[0]
  return {
    stat,
    jobs: await newestJobs(parts.jobIds, 15),
    states: parts.states.map((e) => ({ code: e.code, name: stateName(e.code), slug: stateSlug(e.code), jobs: e.jobs, median: e.median, payCount: e.payCount })),
    employers: parts.employers,
    related: stats.filter((t) => t.slug !== slug && t.base.split(' ').slice(-1)[0] === last).slice(0, 8),
  }
}

/** One job type's page data, or null for an unknown type. */
export async function getJobTypeDetail(slug: string): Promise<JobTypeDetail | null> {
  const type = jobTypeBySlug(slug)
  if (!type) return null
  const [typeList, stats] = await Promise.all([cachedTypes(), getTitleIndex()])
  const sum = new Map(typeList).get(slug)
  const byBase = new Map(stats.map((t) => [t.base, t]))
  return {
    type,
    total: sum?.total ?? 0,
    jobs: await newestJobs(sum?.ids ?? [], 20),
    titles: (sum?.bases ?? []).flatMap((b) => (byBase.has(b) ? [byBase.get(b)!] : [])).slice(0, 12),
    states: (sum?.states ?? []).map((r) => ({ code: r.st, name: stateName(r.st), slug: stateSlug(r.st), jobs: r.n })),
    medianPay: sum && sum.payCount >= TITLE_MIN_PAY ? round(sum.median) : null,
    payCount: sum?.payCount ?? 0,
  }
}
