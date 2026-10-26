import 'server-only'
import { heavy } from '@/lib/db/heavy'
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

const cachedIndex = unstable_cache(() => heavy(loadTitleIndex), ['job-title-index-v1'], { revalidate: 21600 })

/** Every title with enough open listings for a page, most listings first. */
export async function getTitleIndex(): Promise<TitleStat[]> {
  return cachedIndex()
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

async function rowsToJobs(ids: string[], limit: number): Promise<TitleJob[]> {
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

function median(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y)
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

async function loadDetail(slug: string): Promise<TitleDetail | null> {
  const index = await getTitleIndex()
  const stat = index.find((t) => t.slug === slug)
  if (!stat) return null
  // One scan of this title's open listings (a few thousand rows at most); states, employers and the newest jobs come from it.
  const rows = await heavy(() => prisma.$queryRaw<{ id: string; state: string | null; company: string; posted: Date | null; pay: number | null }[]>`
    SELECT id, "locationState" AS state, "companyName" AS company, COALESCE("postedAt", "createdAt") AS posted, ${PAY} AS pay
    FROM "ExclusiveJobPosting" WHERE ${PUBLIC} AND ${BASE} = ${stat.base} ORDER BY COALESCE("postedAt", "createdAt") DESC LIMIT 5000`)
  const jobs = await rowsToJobs(rows.slice(0, 60).map((r) => r.id), 15)
  const byState = new Map<string, { jobs: number; pay: number[] }>()
  const byEmployer = new Map<string, number>()
  for (const r of rows) {
    byEmployer.set(r.company, (byEmployer.get(r.company) ?? 0) + 1)
    if (!r.state) continue
    const e = byState.get(r.state) ?? { jobs: 0, pay: [] }
    e.jobs++
    if (r.pay != null) e.pay.push(Number(r.pay))
    byState.set(r.state, e)
  }
  const last = stat.base.split(' ').slice(-1)[0]
  const related = index.filter((t) => t.slug !== slug && t.base.split(' ').slice(-1)[0] === last).slice(0, 8)
  return {
    stat,
    jobs,
    states: [...byState].sort((a, b) => b[1].jobs - a[1].jobs).slice(0, 12).map(([code, e]) => ({ code, name: stateName(code), slug: stateSlug(code), jobs: e.jobs, median: e.pay.length >= 8 ? round(median(e.pay)) : null, payCount: e.pay.length })),
    employers: [...byEmployer].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, n]) => ({ name, jobs: n })),
    related,
  }
}

const cachedDetail = unstable_cache((slug: string) => loadDetail(slug), ['job-title-detail-v2'], { revalidate: 21600 })

/** One title's page data, or null when the title has no page. */
export async function getTitleDetail(slug: string): Promise<TitleDetail | null> {
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return null
  return cachedDetail(slug)
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

export interface JobTypeDetail { type: Pick<JobType, 'slug' | 'name' | 'noun'>; total: number; jobs: TitleJob[]; titles: TitleStat[]; states: { code: string; name: string; slug: string; jobs: number }[]; medianPay: number | null; payCount: number }

async function loadType(slug: string): Promise<JobTypeDetail | null> {
  const type = jobTypeBySlug(slug)
  if (!type) return null
  // One scan of this type's open listings (tens of thousands of light rows); everything shown comes from it.
  const [rows, index] = await Promise.all([
    heavy(() => prisma.$queryRaw<{ id: string; state: string | null; base: string; pay: number | null }[]>`
      SELECT id, "locationState" AS state, ${BASE} AS base, ${PAY} AS pay
      FROM "ExclusiveJobPosting" WHERE ${PUBLIC} AND ${type.sql} ORDER BY COALESCE("postedAt", "createdAt") DESC LIMIT 60000`),
    getTitleIndex(),
  ])
  const jobs = await rowsToJobs(rows.slice(0, 80).map((r) => r.id), 20)
  const states = new Map<string, number>()
  const bases = new Map<string, number>()
  const pay: number[] = []
  for (const r of rows) {
    if (r.state) states.set(r.state, (states.get(r.state) ?? 0) + 1)
    bases.set(r.base, (bases.get(r.base) ?? 0) + 1)
    if (r.pay != null) pay.push(Number(r.pay))
  }
  const byBase = new Map(index.map((t) => [t.base, t]))
  return {
    type: { slug: type.slug, name: type.name, noun: type.noun },
    total: rows.length,
    jobs,
    titles: [...bases].sort((a, b) => b[1] - a[1]).flatMap(([b]) => (byBase.has(b) ? [byBase.get(b)!] : [])).slice(0, 12),
    states: [...states].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([code, n]) => ({ code, name: stateName(code), slug: stateSlug(code), jobs: n })),
    medianPay: pay.length >= TITLE_MIN_PAY ? round(median(pay)) : null,
    payCount: pay.length,
  }
}

const cachedType = unstable_cache((slug: string) => loadType(slug), ['job-type-v2'], { revalidate: 3600 })
export async function getJobTypeDetail(slug: string): Promise<JobTypeDetail | null> {
  return cachedType(slug)
}
