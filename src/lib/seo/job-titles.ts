import 'server-only'
import { unstable_cache } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PUBLIC_JOB_SELECT } from '@/lib/jobs/public-job-page-server'
import { getConfirmedGhostIds } from '@/lib/jobs/job-dismiss-server'
import { isPublicJob } from '@/lib/jobs/public-job-page'
import { stateName, stateSlug } from '@/lib/seo/states'
import { TITLE_MIN_JOBS, TITLE_MIN_PAY, displayTitle, titleSlug, GENERIC_TITLES } from '@/lib/seo/job-title-rules'

// Data for the salary pages (/salaries/<title>) and the job-title pages (/jobs/title/<title>), and the job-type pages
// (/jobs/type/<type>). Everything comes from the open public job listings: the same rows the job board shows, counted
// with the cheap half of the allowlist (src/lib/seo/topic-data.ts explains why) and listed only after the full rule.
// Pay is what the listing states, annualized (hourly x 2,080 hours); listings without pay are left out of the numbers.

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
}

const round = (n: number | null) => (n == null ? null : Math.round(n / 500) * 500)

async function loadTitleIndex(): Promise<TitleStat[]> {
  const rows = await prisma.$queryRaw<{ base: string; jobs: number; pay_count: number; p25: number | null; med: number | null; p75: number | null }[]>`
    SELECT b AS base, count(*)::int AS jobs, count(pay)::int AS pay_count,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY pay) AS p25,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY pay) AS med,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY pay) AS p75
    FROM (SELECT ${BASE} AS b, ${PAY} AS pay FROM "ExclusiveJobPosting" WHERE ${PUBLIC}) t
    WHERE length(b) BETWEEN 6 AND 60 AND b !~ '[0-9]'
    GROUP BY b HAVING count(*) >= ${TITLE_MIN_JOBS}
    ORDER BY count(*) DESC LIMIT 3000`
  const seen = new Set<string>()
  const out: TitleStat[] = []
  for (const r of rows) {
    if (GENERIC_TITLES.has(r.base)) continue
    const slug = titleSlug(r.base)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    out.push({ slug, base: r.base, name: displayTitle(r.base), jobs: r.jobs, payCount: r.pay_count, p25: round(r.p25), median: round(r.med), p75: round(r.p75) })
  }
  return out
}

const cachedIndex = unstable_cache(loadTitleIndex, ['job-title-index-v1'], { revalidate: 21600 })

/** Every title with enough open listings for a page, most listings first. */
export async function getTitleIndex(): Promise<TitleStat[]> {
  return cachedIndex().catch(() => [])
}

export const hasSalaryPage = (t: TitleStat) => t.payCount >= TITLE_MIN_PAY && t.median != null && t.p25 != null && t.p75 != null

export interface TitleJob { id: string; title: string; company: string; location: string | null; postedAt: string; pay: string | null }
export interface TitleDetail {
  stat: TitleStat
  jobs: TitleJob[]
  states: { code: string; name: string; slug: string; jobs: number; median: number | null; payCount: number }[]
  employers: { name: string; jobs: number }[]
  related: TitleStat[]
}

const k = (n: number) => `$${Math.round(n / 1000)}k`
function payText(min: number | null, max: number | null, period: string | null): string | null {
  if (!min || !max || period !== 'year' || max < min || min < 20_000 || max > 2_000_000) return null
  return min === max ? k(min) : `${k(min)}–${k(max)}`
}

async function listJobs(where: Prisma.Sql, limit = 15): Promise<TitleJob[]> {
  const ids = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "ExclusiveJobPosting" WHERE ${where} ORDER BY "postedAt" DESC NULLS LAST LIMIT ${limit * 4}`
  const [wide, ghosts] = await Promise.all([
    prisma.exclusiveJobPosting.findMany({ where: { id: { in: ids.map((r) => r.id) } }, select: PUBLIC_JOB_SELECT }),
    getConfirmedGhostIds(),
  ])
  const byId = new Map(wide.map((w) => [w.id, w]))
  const now = Date.now()
  return ids
    .flatMap((r) => {
      const w = byId.get(r.id)
      return w && isPublicJob(w, now, ghosts.has(w.id)) ? [w] : []
    })
    .slice(0, limit)
    .map((r) => ({ id: r.id, title: r.title, company: r.companyName, location: r.location, postedAt: (r.postedAt ?? r.createdAt).toISOString(), pay: payText(r.salaryMin, r.salaryMax, r.payPeriod) }))
}

async function loadDetail(slug: string): Promise<TitleDetail | null> {
  const index = await getTitleIndex()
  const stat = index.find((t) => t.slug === slug)
  if (!stat) return null
  const where = Prisma.sql`${PUBLIC} AND ${BASE} = ${stat.base}`
  const [jobs, stateRows, empRows] = await Promise.all([
    listJobs(where),
    prisma.$queryRaw<{ code: string; jobs: number; pay_count: number; med: number | null }[]>`
      SELECT "locationState" AS code, count(*)::int AS jobs, count(pay)::int AS pay_count, percentile_cont(0.5) WITHIN GROUP (ORDER BY pay) AS med
      FROM (SELECT "locationState", ${PAY} AS pay FROM "ExclusiveJobPosting" WHERE ${where} AND "locationState" IS NOT NULL) t
      GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
    prisma.$queryRaw<{ name: string; jobs: number }[]>`
      SELECT "companyName" AS name, count(*)::int AS jobs FROM "ExclusiveJobPosting" WHERE ${where} GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
  ])
  const last = stat.base.split(' ').slice(-1)[0]
  const related = index.filter((t) => t.slug !== slug && t.base.split(' ').slice(-1)[0] === last).slice(0, 8)
  return {
    stat,
    jobs,
    states: stateRows.map((r) => ({ code: r.code, name: stateName(r.code), slug: stateSlug(r.code), jobs: r.jobs, median: r.pay_count >= 8 ? round(r.med) : null, payCount: r.pay_count })),
    employers: empRows.map((r) => ({ name: r.name, jobs: r.jobs })),
    related,
  }
}

const cachedDetail = unstable_cache((slug: string) => loadDetail(slug), ['job-title-detail-v1'], { revalidate: 21600 })

/** One title's page data, or null when the title has no page. */
export async function getTitleDetail(slug: string): Promise<TitleDetail | null> {
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return null
  return cachedDetail(slug).catch(() => null)
}

// ---- job types -----------------------------------------------------------------------------------------------

export interface JobType { slug: string; name: string; sql: Prisma.Sql; noun: string }

export const JOB_TYPES: JobType[] = [
  { slug: 'remote', name: 'Remote', noun: 'remote', sql: Prisma.sql`"workArrangement" = 'remote'` },
  { slug: 'hybrid', name: 'Hybrid', noun: 'hybrid', sql: Prisma.sql`"workArrangement" = 'hybrid'` },
  { slug: 'contract', name: 'Contract', noun: 'contract', sql: Prisma.sql`"employmentType" = 'contract'` },
  { slug: 'part-time', name: 'Part-time', noun: 'part-time', sql: Prisma.sql`"employmentType" = 'part_time'` },
  { slug: 'interim', name: 'Interim', noun: 'interim', sql: Prisma.sql`"employmentType" = 'interim'` },
]

export const jobTypeBySlug = (slug: string) => JOB_TYPES.find((t) => t.slug === slug)

export interface JobTypeDetail { type: JobType; total: number; jobs: TitleJob[]; titles: TitleStat[]; states: { code: string; name: string; slug: string; jobs: number }[]; medianPay: number | null; payCount: number }

async function loadType(slug: string): Promise<JobTypeDetail | null> {
  const type = jobTypeBySlug(slug)
  if (!type) return null
  const where = Prisma.sql`${PUBLIC} AND ${type.sql}`
  const [count, jobs, stateRows, titleRows, payRows, index] = await Promise.all([
    prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "ExclusiveJobPosting" WHERE ${where}`,
    listJobs(where, 20),
    prisma.$queryRaw<{ code: string; jobs: number }[]>`SELECT "locationState" AS code, count(*)::int AS jobs FROM "ExclusiveJobPosting" WHERE ${where} AND "locationState" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
    prisma.$queryRaw<{ base: string }[]>`SELECT ${BASE} AS base FROM "ExclusiveJobPosting" WHERE ${where} GROUP BY 1 ORDER BY count(*) DESC LIMIT 60`,
    prisma.$queryRaw<{ med: number | null; n: number }[]>`SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY pay) AS med, count(pay)::int AS n FROM (SELECT ${PAY} AS pay FROM "ExclusiveJobPosting" WHERE ${where}) t`,
    getTitleIndex(),
  ])
  const byBase = new Map(index.map((t) => [t.base, t]))
  return {
    type,
    total: count[0]?.n ?? 0,
    jobs,
    titles: titleRows.flatMap((r) => (byBase.has(r.base) ? [byBase.get(r.base)!] : [])).slice(0, 12),
    states: stateRows.map((r) => ({ code: r.code, name: stateName(r.code), slug: stateSlug(r.code), jobs: r.jobs })),
    medianPay: payRows[0]?.n >= TITLE_MIN_PAY ? round(payRows[0].med) : null,
    payCount: payRows[0]?.n ?? 0,
  }
}

const cachedType = unstable_cache((slug: string) => loadType(slug), ['job-type-v1'], { revalidate: 3600 })
export async function getJobTypeDetail(slug: string): Promise<JobTypeDetail | null> {
  return cachedType(slug).catch(() => null)
}
