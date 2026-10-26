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
type PhraseRow = { id: string; title: string; phrase: string }

// One query per block, each reading its rows once (a CTE) and returning everything as JSON. A cold employer page used
// to run about a dozen queries at once against a connection pool of a few, so one crawler hit could starve every other
// request; this uses three connections at most.
async function liveFor(companyId: string): Promise<EmployerLive> {
  const [row] = await prisma.$queryRaw<
    {
      agg: {
        open: number; entry: number; no_exp: number; training: number; ai_skill: number; clearance: number; no_sponsorship: number
        remote: number; hybrid: number; onsite: number; full_time: number; contract: number; part_time: number; posted_pay: number
        new7d: number; median_age: number | null
      }
      skills: CountRow[]; tools: CountRow[]; certs: CountRow[]; no_exp_rows: PhraseRow[]; train_rows: PhraseRow[]
    }[]
  >(Prisma.sql`WITH j AS (
      SELECT "level", "postingSignals", "aiSkillGroups", "requirementFlags", "workArrangement", "employmentType", "salaryMin", "salaryMax",
        "postedAt", "createdAt", "skills", "aiToolsNamed", "aiCertsNamed", "id", "title", "noExperiencePhrase", "trainingPhrase"
      FROM "ExclusiveJobPosting" WHERE "companyId" = ${companyId} AND ${LIVE}
    )
    SELECT
      (SELECT row_to_json(a) FROM (SELECT count(*)::int AS open,
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
        FROM j) a) AS agg,
      (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT s AS name, count(*)::int AS count FROM (SELECT unnest("skills") AS s FROM j) x WHERE s <> '' GROUP BY s ORDER BY count DESC, s LIMIT 10) t) AS skills,
      (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT s AS name, count(*)::int AS count FROM (SELECT unnest("aiToolsNamed") AS s FROM j) x WHERE s <> '' GROUP BY s ORDER BY count DESC, s LIMIT 6) t) AS tools,
      (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT s AS name, count(*)::int AS count FROM (SELECT unnest("aiCertsNamed") AS s FROM j) x WHERE s <> '' GROUP BY s ORDER BY count DESC, s LIMIT 4) t) AS certs,
      (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id" AS id, "title" AS title, "noExperiencePhrase" AS phrase FROM j WHERE "noExperiencePhrase" IS NOT NULL ORDER BY COALESCE("postedAt", "createdAt") DESC LIMIT 3) t) AS no_exp_rows,
      (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT "id" AS id, "title" AS title, "trainingPhrase" AS phrase FROM j WHERE "trainingPhrase" IS NOT NULL ORDER BY COALESCE("postedAt", "createdAt") DESC LIMIT 1) t) AS train_rows`)
  const a = row?.agg
  return {
    open: a?.open ?? 0, entry: a?.entry ?? 0, noExp: a?.no_exp ?? 0, training: a?.training ?? 0, aiSkill: a?.ai_skill ?? 0,
    clearance: a?.clearance ?? 0, noSponsorship: a?.no_sponsorship ?? 0,
    remote: a?.remote ?? 0, hybrid: a?.hybrid ?? 0, onsite: a?.onsite ?? 0,
    fullTime: a?.full_time ?? 0, contract: a?.contract ?? 0, partTime: a?.part_time ?? 0,
    postedPay: a?.posted_pay ?? 0, new7d: a?.new7d ?? 0, medianAgeDays: a?.median_age != null ? Math.round(a.median_age) : null,
    topSkills: row?.skills ?? [], aiTools: row?.tools ?? [], aiCerts: row?.certs ?? [],
    noExpExamples: row?.no_exp_rows ?? [], trainingExample: row?.train_rows?.[0] ?? null,
  }
}

async function historyFor(companyId: string): Promise<EmployerHistory> {
  const [row] = await prisma.$queryRaw<
    { months: { month: string; opened: number }[]; closed: number; first_seen: Date | null; last90: number; prior90: number }[]
  >(Prisma.sql`SELECT
      (SELECT COALESCE(json_agg(m ORDER BY m.month), '[]'::json) FROM (
        SELECT to_char(date_trunc('month', "firstSeenAt"), 'YYYY-MM') AS month, count(*)::int AS opened
        FROM "CompanyJobOpening" WHERE "companyId" = ${companyId} AND "firstSeenAt" >= date_trunc('month', now()) - interval '11 months'
        GROUP BY 1) m) AS months,
      count(*) FILTER (WHERE "closedAt" > now() - interval '12 months')::int AS closed,
      min("firstSeenAt") AS first_seen,
      count(*) FILTER (WHERE "firstSeenAt" > now() - interval '90 days')::int AS last90,
      count(*) FILTER (WHERE "firstSeenAt" <= now() - interval '90 days' AND "firstSeenAt" > now() - interval '180 days')::int AS prior90
    FROM "CompanyJobOpening" WHERE "companyId" = ${companyId}`)
  const trackedSince = row?.first_seen ?? null
  const trackedDays = trackedSince ? Math.floor((Date.now() - trackedSince.getTime()) / 86_400_000) : 0
  const byKey = new Map((row?.months ?? []).map((m) => [m.month, m.opened]))
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
    closed12mo: row?.closed ?? 0,
    trackedSince: trackedSince ? trackedSince.toISOString().slice(0, 10) : null,
    trackedDays,
    last90: row?.last90 ?? 0,
    prior90: row?.prior90 ?? 0,
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
  const [row] = await prisma.$queryRaw<
    { ahead: number; total: number; similar: { id: string; name: string; canonical: string; open: number }[] }[]
  >(Prisma.sql`WITH peers AS (
      SELECT c.id, c.name, c."canonicalNameNormalized" AS canonical, p."openNow" AS open
      FROM "CompanyHiringProfile" p JOIN "Company" c ON c.id = p."companyId"
      WHERE COALESCE(c.industry, p.industry) = ${industry} AND p."openNow" >= 3
    )
    SELECT (SELECT count(*) FROM peers WHERE open > ${open})::int AS ahead,
      (SELECT count(*) FROM peers)::int AS total,
      (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT id, name, canonical, open FROM peers WHERE id <> ${companyId} ORDER BY abs(open - ${open}), name LIMIT 6) t) AS similar`)
  return {
    rank: row && row.total > 0 && open >= 3 ? { position: row.ahead + 1, of: row.total } : null,
    similar: (row?.similar ?? []).map((s) => ({ name: s.name, slug: employerSlug(s.canonical, s.id), open: s.open })),
  }
}

export async function getEmployerInsights(companyId: string, industry: string | null, profile: ProfileFigures): Promise<EmployerInsights> {
  const [live, history, benchmarks] = await Promise.all([liveFor(companyId), historyFor(companyId), cachedBenchmarks().catch(() => [] as IndustryBenchmark[])])
  const benchmark = industry ? benchmarks.find((b) => b.industry === industry) ?? null : null
  const { rank, similar } = industry ? await rankAndSimilar(companyId, industry, live.open).catch(() => ({ rank: null, similar: [] })) : { rank: null, similar: [] }
  return { live, history, benchmark, profile, rank, similar }
}
