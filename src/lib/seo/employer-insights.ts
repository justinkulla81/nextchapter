import 'server-only'
import { unstable_cache } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { LIVE_PUBLIC_SQL } from '@/lib/seo/employer-rankings'
import { employerSlug } from '@/lib/seo/employer-slug'

// Live, employer-specific facts for an employer page, counted from its own open jobs and opening history (no AI, no
// per-use cost). These are what make a page worth indexing: no other site has this employer's skills asked, entry-level
// and no-experience roles in its own words, 12-month hiring trend, how long its roles stay listed, or how it compares
// with its industry. Layoffs are deliberately absent.

const LIVE = Prisma.raw(LIVE_PUBLIC_SQL)

export interface EmployerLive {
  open: number
  entry: number
  noExp: number
  training: number
  aiSkill: number
  clearance: number
  noSponsorship: number
  remote: number
  hybrid: number
  onsite: number
  fullTime: number
  contract: number
  partTime: number
  postedPay: number
  new7d: number
  medianAgeDays: number | null
  topSkills: { name: string; count: number }[]
  aiTools: { name: string; count: number }[]
  aiCerts: { name: string; count: number }[]
  noExpExamples: { id: string; title: string; phrase: string }[]
  trainingExample: { id: string; title: string; phrase: string } | null
}

export interface EmployerHistory {
  /** Roles first seen per month, oldest first, last 12 months (zero-filled). */
  months: { month: string; opened: number }[]
  opened12mo: number
  closed12mo: number
  /** First time we saw any role at this employer; history before it does not exist, so nothing is compared across it. */
  trackedSince: string | null
  trackedDays: number
  /** Roles first seen in the last 90 days vs the 90 days before. */
  last90: number
  prior90: number
}

export interface IndustryBenchmark {
  industry: string
  employers: number
  medianOpen: number
  medianPostedPayShare: number | null
  medianRemoteShare: number | null
}

/** The employer's own figures from its hiring profile, so the comparison uses the same definitions as the benchmark. */
export interface ProfileFigures { postedPayShare: number | null; remoteShare: number | null }

export interface SimilarEmployer { name: string; slug: string; open: number }

export interface EmployerInsights {
  live: EmployerLive
  history: EmployerHistory
  benchmark: IndustryBenchmark | null
  profile: ProfileFigures
  /** Rank by open roles among employers in the same industry (1 = most), of `rankOf`. */
  rank: { position: number; of: number } | null
  similar: SimilarEmployer[]
}

type CountRow = { name: string; count: number }

async function liveFor(companyId: string): Promise<EmployerLive> {
  const [row] = await prisma.$queryRaw<
    {
      open: number; entry: number; no_exp: number; training: number; ai_skill: number; clearance: number; no_sponsorship: number
      remote: number; hybrid: number; onsite: number; full_time: number; contract: number; part_time: number; posted_pay: number
      new7d: number; median_age: number | null
    }[]
  >(Prisma.sql`SELECT count(*)::int AS open,
      count(*) FILTER (WHERE "level" IN ('ENTRY_IC', 'EARLY_IC'))::int AS entry,
      count(*) FILTER (WHERE "level" IN ('ENTRY_IC', 'EARLY_IC') AND 'no_experience_ok' = ANY("postingSignals"))::int AS no_exp,
      count(*) FILTER (WHERE "level" IN ('ENTRY_IC', 'EARLY_IC') AND 'training_provided' = ANY("postingSignals"))::int AS training,
      count(*) FILTER (WHERE cardinality("aiSkillGroups") > 0)::int AS ai_skill,
      count(*) FILTER (WHERE jsonb_typeof("requirementFlags") = 'array' AND "requirementFlags" @> '[{"flag":"clearance"}]')::int AS clearance,
      count(*) FILTER (WHERE jsonb_typeof("requirementFlags") = 'array' AND "requirementFlags" @> '[{"flag":"no_sponsorship"}]')::int AS no_sponsorship,
      count(*) FILTER (WHERE "workArrangement" = 'remote')::int AS remote,
      count(*) FILTER (WHERE "workArrangement" = 'hybrid')::int AS hybrid,
      count(*) FILTER (WHERE "workArrangement" = 'onsite')::int AS onsite,
      count(*) FILTER (WHERE "employmentType" = 'full_time')::int AS full_time,
      count(*) FILTER (WHERE "employmentType" IN ('contract', 'temporary', 'interim'))::int AS contract,
      count(*) FILTER (WHERE "employmentType" = 'part_time')::int AS part_time,
      count(*) FILTER (WHERE "salaryMin" IS NOT NULL OR "salaryMax" IS NOT NULL)::int AS posted_pay,
      count(*) FILTER (WHERE COALESCE("postedAt", "createdAt") > now() - interval '7 days')::int AS new7d,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (now() - COALESCE("postedAt", "createdAt"))) / 86400)::float8 AS median_age
    FROM "ExclusiveJobPosting" WHERE "companyId" = ${companyId} AND ${LIVE}`)

  const tally = (col: 'skills' | 'aiToolsNamed' | 'aiCertsNamed', n: number) =>
    prisma.$queryRaw<CountRow[]>(Prisma.sql`SELECT s AS name, count(*)::int AS count
      FROM (SELECT unnest(${Prisma.raw(`"${col}"`)}) AS s FROM "ExclusiveJobPosting" WHERE "companyId" = ${companyId} AND ${LIVE}) t
      WHERE s <> '' GROUP BY s ORDER BY count DESC, s LIMIT ${n}`)
  const [topSkills, aiTools, aiCerts, noExpRows, trainRows] = await Promise.all([
    tally('skills', 10),
    tally('aiToolsNamed', 6),
    tally('aiCertsNamed', 4),
    prisma.$queryRaw<{ id: string; title: string; phrase: string }[]>(Prisma.sql`SELECT id, title, "noExperiencePhrase" AS phrase
      FROM "ExclusiveJobPosting" WHERE "companyId" = ${companyId} AND ${LIVE} AND "noExperiencePhrase" IS NOT NULL
      ORDER BY COALESCE("postedAt", "createdAt") DESC LIMIT 3`),
    prisma.$queryRaw<{ id: string; title: string; phrase: string }[]>(Prisma.sql`SELECT id, title, "trainingPhrase" AS phrase
      FROM "ExclusiveJobPosting" WHERE "companyId" = ${companyId} AND ${LIVE} AND "trainingPhrase" IS NOT NULL
      ORDER BY COALESCE("postedAt", "createdAt") DESC LIMIT 1`),
  ])
  return {
    open: row?.open ?? 0, entry: row?.entry ?? 0, noExp: row?.no_exp ?? 0, training: row?.training ?? 0, aiSkill: row?.ai_skill ?? 0,
    clearance: row?.clearance ?? 0, noSponsorship: row?.no_sponsorship ?? 0,
    remote: row?.remote ?? 0, hybrid: row?.hybrid ?? 0, onsite: row?.onsite ?? 0,
    fullTime: row?.full_time ?? 0, contract: row?.contract ?? 0, partTime: row?.part_time ?? 0,
    postedPay: row?.posted_pay ?? 0, new7d: row?.new7d ?? 0, medianAgeDays: row?.median_age != null ? Math.round(row.median_age) : null,
    topSkills, aiTools, aiCerts,
    noExpExamples: noExpRows, trainingExample: trainRows[0] ?? null,
  }
}

async function historyFor(companyId: string): Promise<EmployerHistory> {
  const [months, [stats]] = await Promise.all([
    prisma.$queryRaw<{ month: Date; opened: number }[]>(Prisma.sql`SELECT date_trunc('month', "firstSeenAt") AS month, count(*)::int AS opened
      FROM "CompanyJobOpening" WHERE "companyId" = ${companyId} AND "firstSeenAt" >= date_trunc('month', now()) - interval '11 months'
      GROUP BY 1 ORDER BY 1`),
    prisma.$queryRaw<{ closed: number; first_seen: Date | null; last90: number; prior90: number }[]>(Prisma.sql`SELECT
        count(*) FILTER (WHERE "closedAt" > now() - interval '12 months')::int AS closed,
        min("firstSeenAt") AS first_seen,
        count(*) FILTER (WHERE "firstSeenAt" > now() - interval '90 days')::int AS last90,
        count(*) FILTER (WHERE "firstSeenAt" <= now() - interval '90 days' AND "firstSeenAt" > now() - interval '180 days')::int AS prior90
      FROM "CompanyJobOpening" WHERE "companyId" = ${companyId}`),
  ])
  const trackedSince = stats?.first_seen ?? null
  const trackedDays = trackedSince ? Math.floor((Date.now() - trackedSince.getTime()) / 86_400_000) : 0
  const byKey = new Map(months.map((m) => [m.month.toISOString().slice(0, 7), m.opened]))
  const startKey = trackedSince ? trackedSince.toISOString().slice(0, 7) : null
  const now = new Date()
  const filled: { month: string; opened: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const key = d.toISOString().slice(0, 7)
    // Months before our first sighting are not zero hiring, they are unknown: leave them out.
    if (startKey && key >= startKey) filled.push({ month: key, opened: byKey.get(key) ?? 0 })
  }
  return {
    months: filled,
    opened12mo: filled.reduce((sum, m) => sum + m.opened, 0),
    closed12mo: stats?.closed ?? 0,
    trackedSince: trackedSince ? trackedSince.toISOString().slice(0, 10) : null,
    trackedDays,
    last90: stats?.last90 ?? 0,
    prior90: stats?.prior90 ?? 0,
  }
}

async function loadBenchmarks(): Promise<IndustryBenchmark[]> {
  const rows = await prisma.$queryRaw<
    { industry: string; employers: number; median_open: number; pay_share: number | null; remote_share: number | null }[]
  >(Prisma.sql`SELECT COALESCE(c.industry, p.industry) AS industry, count(*)::int AS employers,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY p."openNow")::float8 AS median_open,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY p."postedPayShare")::float8 AS pay_share,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY p."remoteShare")::float8 AS remote_share
    FROM "CompanyHiringProfile" p JOIN "Company" c ON c.id = p."companyId"
    WHERE p."openNow" >= 3 AND COALESCE(c.industry, p.industry) IS NOT NULL
    GROUP BY 1 HAVING count(*) >= 10`)
  return rows.map((r) => ({ industry: r.industry, employers: r.employers, medianOpen: Math.round(r.median_open), medianPostedPayShare: r.pay_share, medianRemoteShare: r.remote_share }))
}
const cachedBenchmarks = unstable_cache(loadBenchmarks, ['employer-industry-benchmarks-v2'], { revalidate: 86_400 })

async function rankAndSimilar(companyId: string, industry: string, open: number): Promise<{ rank: EmployerInsights['rank']; similar: SimilarEmployer[] }> {
  const [[r], similarRows] = await Promise.all([
    prisma.$queryRaw<{ ahead: number; total: number }[]>(Prisma.sql`SELECT
        count(*) FILTER (WHERE p."openNow" > ${open})::int AS ahead, count(*)::int AS total
      FROM "CompanyHiringProfile" p JOIN "Company" c ON c.id = p."companyId"
      WHERE COALESCE(c.industry, p.industry) = ${industry} AND p."openNow" >= 3`),
    prisma.$queryRaw<{ id: string; name: string; canonical: string; open: number }[]>(Prisma.sql`SELECT c.id, c.name, c."canonicalNameNormalized" AS canonical, p."openNow" AS open
      FROM "CompanyHiringProfile" p JOIN "Company" c ON c.id = p."companyId"
      WHERE COALESCE(c.industry, p.industry) = ${industry} AND p."openNow" >= 3 AND c.id <> ${companyId}
      ORDER BY abs(p."openNow" - ${open}), c.name LIMIT 6`),
  ])
  return {
    rank: r && r.total > 0 && open >= 3 ? { position: r.ahead + 1, of: r.total } : null,
    similar: similarRows.map((s) => ({ name: s.name, slug: employerSlug(s.canonical, s.id), open: s.open })),
  }
}

export async function getEmployerInsights(companyId: string, industry: string | null, profile: ProfileFigures): Promise<EmployerInsights> {
  const [live, history, benchmarks] = await Promise.all([liveFor(companyId), historyFor(companyId), cachedBenchmarks().catch(() => [] as IndustryBenchmark[])])
  const benchmark = industry ? benchmarks.find((b) => b.industry === industry) ?? null : null
  const { rank, similar } = industry ? await rankAndSimilar(companyId, industry, live.open).catch(() => ({ rank: null, similar: [] })) : { rank: null, similar: [] }
  return { live, history, benchmark, profile, rank, similar }
}
