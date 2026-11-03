import 'server-only'
import { prisma } from '@/lib/prisma'
import { CRAWLER_FUNCTION_LABEL } from '@/lib/jobs/job-functions'
import { INDUSTRY_LABEL } from '@/lib/seo/search-firm-bar'
import { writeBoardFigure, readBoardFigure } from '@/lib/jobs/stored-board-figures'
import { buildGroups, buildSkills, statOf, type RawGroupRow, type RawLikeRow, type RawSkillRow, type RawStat } from './assemble'
import { PAY_LEVEL_LABEL, SCALE_BANDS, SIZE_BANDS, SIZE_BAND_LABEL, type PayData, type PayDataSnapshot, type SizeBand } from './types'

// The pay figures behind /resources/pay-data (method: docs/PAY_DATA.md). One pass over the live board's paid postings into a temporary
// table inside one transaction, then one grouped query per cut. Run by the pay-data cron, never by a page view: it takes about a minute.
//
// What is counted: live postings (not archived, approved, not expired, not an internship) with pay the employer posted or that sits in
// the posting text, annualized from the posted period, between $20,000 and $1,500,000. The pay of a posting is the midpoint of its range.
// Board-listed and estimated pay are left out, as in the AI pay premium (src/lib/skills/ai-market-live.ts).

const LIVE = `e."archivedAt" IS NULL AND e.status = 'approved' AND (e."expiresAt" IS NULL OR e."expiresAt" > now()) AND COALESCE(e."employmentType", '') NOT IN ('internship', 'co_op', 'coop')`
const PAID = `(e."salaryMin" IS NOT NULL OR e."salaryMax" IS NOT NULL) AND e."paySource" IN ('posted', 'text') AND COALESCE(e."payPeriod", 'year') IN ('year', 'hour', 'day', 'week', 'month')`
const PAY = `(COALESCE(e."salaryMin", e."salaryMax") + COALESCE(e."salaryMax", e."salaryMin")) / 2.0 * CASE COALESCE(e."payPeriod", 'year') WHEN 'year' THEN 1 WHEN 'hour' THEN 2080 WHEN 'day' THEN 260 WHEN 'week' THEN 52 WHEN 'month' THEN 12 END`
const LEVEL = `CASE e."level" WHEN 'ENTRY_IC' THEN 'entry' WHEN 'EARLY_IC' THEN 'early' WHEN 'MID_IC' THEN 'mid'
  WHEN 'SENIOR_IC' THEN 'senior' WHEN 'PRINCIPAL' THEN 'senior' WHEN 'MANAGER' THEN 'manager' WHEN 'SR_MANAGER' THEN 'manager'
  WHEN 'DIRECTOR' THEN 'director' WHEN 'HEAD' THEN 'director' WHEN 'CHIEF_OF_STAFF' THEN 'director' WHEN 'SCHOOL_LEADER' THEN 'director'
  WHEN 'VP' THEN 'vp' WHEN 'EVP_SVP' THEN 'vp' WHEN 'C_SUITE' THEN 'vp' WHEN 'PARTNER' THEN 'vp' WHEN 'BOARD' THEN 'vp' END`
// A size from the permanent lookup counts when the curated list set it or the model was at least 50% sure; otherwise the Company's own band.
const SIZE = `CASE WHEN l.id IS NOT NULL AND (l.source = 'static' OR COALESCE(l.confidence, 1) >= 0.5) THEN l."sizeBand"::text ELSE c."sizeBand"::text END`
const SCALE = `CASE WHEN h."openNow" IS NULL OR h."openNow" < 1 THEN NULL WHEN h."openNow" < 5 THEN '1-4' WHEN h."openNow" < 20 THEN '5-19'
  WHEN h."openNow" < 100 THEN '20-99' WHEN h."openNow" < 500 THEN '100-499' ELSE '500+' END`

interface GroupSqlRow { key: string; lvl: string | null; n: number; companies: number; p25: number; p50: number; p75: number }
interface SkillSqlRow extends RawStat {
  skill: string
  top_company_n: number
  base_p50: number
  like_pct: number | null
  like_usd: number | null
  like_n: number | null
  like_cells: number | null
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const groupSql = (col: string) => `
  SELECT ${col} AS key, lvl, count(*)::int AS n, count(DISTINCT company_id)::int AS companies,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY pay)::float8 AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY pay)::float8 AS p50,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY pay)::float8 AS p75
  FROM pd_base WHERE ${col} IS NOT NULL GROUP BY GROUPING SETS ((${col}), (${col}, lvl))`

interface LikeSqlRow { key: string; like_pct: number; like_usd: number; like_n: number; like_cells: number }

/** Gap of each group against all other postings in the same cells (cells of 15+ on both sides), weighted by the group's postings. */
const likeSql = (col: string, cells: string[]) => {
  const cols = cells.join(', ')
  const notNull = [col, ...cells].map((c) => `${c} IS NOT NULL`).join(' AND ')
  return `
  WITH g AS (SELECT ${col} AS key, ${cols}, count(*)::int AS n_g, sum(ln(pay)) AS sl_g FROM pd_base WHERE ${notNull} GROUP BY ${col}, ${cols}),
    a AS (SELECT ${cols}, count(*)::int AS n_a, sum(ln(pay)) AS sl_a FROM pd_base WHERE ${notNull} GROUP BY ${cols}),
    c AS (SELECT g.key, g.n_g, g.sl_g / g.n_g AS m_g, (a.sl_a - g.sl_g) / (a.n_a - g.n_g) AS m_r
          FROM g JOIN a USING (${cols}) WHERE g.n_g >= 15 AND a.n_a - g.n_g >= 15)
  SELECT key, (100 * (exp(sum(n_g * (m_g - m_r)) / sum(n_g)) - 1))::float8 AS like_pct, (sum(n_g * (exp(m_g) - exp(m_r))) / sum(n_g))::float8 AS like_usd,
    sum(n_g)::int AS like_n, count(*)::int AS like_cells FROM c GROUP BY key`
}
const toLikeRows = (rows: LikeSqlRow[]): RawLikeRow[] => rows.map((r) => ({ key: r.key, likePct: r.like_pct, likeUsd: r.like_usd, likeN: r.like_n, likeCells: r.like_cells }))

const toGroupRows = (rows: GroupSqlRow[]): RawGroupRow[] =>
  rows.map((r) => ({ key: r.key, lvl: r.lvl, n: r.n, companies: r.companies, p25: r.p25, p50: r.p50, p75: r.p75 }))

async function skillRows(tx: Tx): Promise<{ rows: RawSkillRow[]; topFunctions: Map<string, { label: string; n: number }[]> }> {
  // One row per (posting, skill), only for postings that list at least one skill. "Without the skill" means a posting that lists others.
  await tx.$executeRawUnsafe(`CREATE TEMP TABLE pd_skill ON COMMIT DROP AS
    SELECT b.company_id, b.fn, b.lvl, b.ind, b.pay, u.skill FROM pd_base b, unnest(b.skills) AS u(skill) WHERE cardinality(b.skills) > 0`)
  await tx.$executeRawUnsafe(`CREATE TEMP TABLE pd_skilled ON COMMIT DROP AS SELECT company_id, fn, lvl, ind, pay, skills FROM pd_base WHERE cardinality(skills) > 0`)

  const rows = await tx.$queryRawUnsafe<SkillSqlRow[]>(`
    WITH stat AS (
      SELECT skill, count(*)::int AS n, count(DISTINCT company_id)::int AS companies,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY pay)::float8 AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY pay)::float8 AS p50,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY pay)::float8 AS p75
      FROM pd_skill GROUP BY skill HAVING count(*) >= 100 AND count(DISTINCT company_id) >= 15),
    topco AS (SELECT skill, max(c)::int AS top_company_n FROM (SELECT skill, company_id, count(*) AS c FROM pd_skill WHERE skill IN (SELECT skill FROM stat) GROUP BY 1, 2) t GROUP BY 1),
    base AS (
      SELECT s.skill, percentile_cont(0.5) WITHIN GROUP (ORDER BY k.pay)::float8 AS base_p50
      FROM stat s JOIN pd_skilled k ON NOT (k.skills @> ARRAY[s.skill]) GROUP BY s.skill),
    cell_all AS (
      SELECT fn, lvl, ind, count(*)::int AS n_all, sum(ln(pay)) AS sl_all FROM pd_skilled WHERE fn IS NOT NULL AND lvl IS NOT NULL AND ind IS NOT NULL GROUP BY 1, 2, 3),
    cell_sk AS (
      SELECT skill, fn, lvl, ind, count(*)::int AS n_s, sum(ln(pay)) AS sl_s
      FROM pd_skill WHERE fn IS NOT NULL AND lvl IS NOT NULL AND ind IS NOT NULL AND skill IN (SELECT skill FROM stat) GROUP BY 1, 2, 3, 4),
    like_c AS (
      SELECT cs.skill, cs.n_s, cs.sl_s / cs.n_s AS m_s, (ca.sl_all - cs.sl_s) / (ca.n_all - cs.n_s) AS m_r
      FROM cell_sk cs JOIN cell_all ca USING (fn, lvl, ind) WHERE cs.n_s >= 15 AND ca.n_all - cs.n_s >= 15),
    likes AS (
      SELECT skill, sum(n_s)::int AS like_n, count(*)::int AS like_cells,
        (100 * (exp(sum(n_s * (m_s - m_r)) / sum(n_s)) - 1))::float8 AS like_pct,
        (sum(n_s * (exp(m_s) - exp(m_r))) / sum(n_s))::float8 AS like_usd
      FROM like_c GROUP BY skill)
    SELECT s.skill, s.n, s.companies, s.p25, s.p50, s.p75, t.top_company_n, b.base_p50,
      l.like_pct, l.like_usd, l.like_n, l.like_cells
    FROM stat s JOIN topco t USING (skill) JOIN base b USING (skill) LEFT JOIN likes l USING (skill)`)

  const fnRows = await tx.$queryRawUnsafe<{ skill: string; fn: string; n: number }[]>(`
    SELECT skill, fn, n FROM (
      SELECT skill, fn, count(*)::int AS n, row_number() OVER (PARTITION BY skill ORDER BY count(*) DESC) AS r
      FROM pd_skill WHERE fn IS NOT NULL AND skill IN (SELECT skill FROM pd_skill GROUP BY skill HAVING count(*) >= 100) GROUP BY 1, 2) t WHERE r <= 3`)
  const topFunctions = new Map<string, { label: string; n: number }[]>()
  for (const r of fnRows) topFunctions.set(r.skill, [...(topFunctions.get(r.skill) ?? []), { label: r.fn, n: r.n }])

  return {
    rows: rows.map((r) => ({
      skill: r.skill, n: r.n, companies: r.companies, p25: r.p25, p50: r.p50, p75: r.p75, topCompanyN: r.top_company_n, baseP50: r.base_p50,
      likePct: r.like_pct, likeUsd: r.like_usd, likeN: r.like_n, likeCells: r.like_cells,
    })),
    topFunctions,
  }
}

export async function computePayData(now = new Date()): Promise<PayData> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = 240000`)
      await tx.$executeRawUnsafe(`CREATE TEMP TABLE pd_base ON COMMIT DROP AS
        SELECT e."companyId" AS company_id, e."targetFunction" AS fn, ${LEVEL} AS lvl, e.industry AS ind, e.skills AS skills, ${PAY} AS pay,
          ${SIZE} AS size, ${SCALE} AS scale
        FROM "ExclusiveJobPosting" e
        LEFT JOIN "Company" c ON c.id = e."companyId"
        LEFT JOIN "CompanySizeLookup" l ON l."companyNameNormalized" = c."canonicalNameNormalized"
        LEFT JOIN "CompanyHiringProfile" h ON h."companyId" = e."companyId"
        WHERE ${LIVE} AND ${PAID}`)
      await tx.$executeRawUnsafe(`DELETE FROM pd_base WHERE pay IS NULL OR pay < 20000 OR pay > 1500000`)

      const [overall] = await tx.$queryRawUnsafe<GroupSqlRow[]>(`
        SELECT 'all' AS key, NULL AS lvl, count(*)::int AS n, count(DISTINCT company_id)::int AS companies,
          percentile_cont(0.25) WITHIN GROUP (ORDER BY pay)::float8 AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY pay)::float8 AS p50,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY pay)::float8 AS p75 FROM pd_base`)
      const [cov] = await tx.$queryRawUnsafe<{ paid_skills: number; sized: number }[]>(
        `SELECT count(*) FILTER (WHERE cardinality(skills) > 0)::int AS paid_skills, count(*) FILTER (WHERE size IS NOT NULL)::int AS sized FROM pd_base`
      )
      const [live] = await tx.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "ExclusiveJobPosting" e WHERE ${LIVE}`)

      const industry = await tx.$queryRawUnsafe<GroupSqlRow[]>(groupSql('ind'))
      const fn = await tx.$queryRawUnsafe<GroupSqlRow[]>(groupSql('fn'))
      const size = await tx.$queryRawUnsafe<GroupSqlRow[]>(groupSql('size'))
      const scale = await tx.$queryRawUnsafe<GroupSqlRow[]>(groupSql('scale'))
      const level = await tx.$queryRawUnsafe<GroupSqlRow[]>(`
        SELECT lvl AS key, NULL AS lvl, count(*)::int AS n, count(DISTINCT company_id)::int AS companies,
          percentile_cont(0.25) WITHIN GROUP (ORDER BY pay)::float8 AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY pay)::float8 AS p50,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY pay)::float8 AS p75 FROM pd_base WHERE lvl IS NOT NULL GROUP BY lvl`)

      const likeIndustry = toLikeRows(await tx.$queryRawUnsafe<LikeSqlRow[]>(likeSql('ind', ['fn', 'lvl'])))
      const likeFn = toLikeRows(await tx.$queryRawUnsafe<LikeSqlRow[]>(likeSql('fn', ['lvl', 'ind'])))
      const likeSize = toLikeRows(await tx.$queryRawUnsafe<LikeSqlRow[]>(likeSql('size', ['fn', 'lvl', 'ind'])))
      const likeScale = toLikeRows(await tx.$queryRawUnsafe<LikeSqlRow[]>(likeSql('scale', ['fn', 'lvl', 'ind'])))

      const { rows, topFunctions } = await skillRows(tx)
      const skills = buildSkills(rows, topFunctions)

      const bySkillFn = await tx.$queryRawUnsafe<{ fn: string; skill: string; n: number; p50: number }[]>(`
        SELECT fn, skill, n, p50 FROM (
          SELECT fn, skill, count(*)::int AS n, percentile_cont(0.5) WITHIN GROUP (ORDER BY pay)::float8 AS p50,
            row_number() OVER (PARTITION BY fn ORDER BY percentile_cont(0.5) WITHIN GROUP (ORDER BY pay) DESC) AS r
          FROM pd_skill WHERE fn IS NOT NULL AND skill IN (SELECT skill FROM pd_skill GROUP BY skill HAVING count(*) >= 100)
          GROUP BY fn, skill HAVING count(*) >= 50 AND count(DISTINCT company_id) >= 10) t WHERE r <= 8`)
      const allowed = new Set(skills.map((s) => s.skill))
      const skillsByFunction: PayData['skillsByFunction'] = {}
      for (const r of bySkillFn) if (allowed.has(r.skill)) (skillsByFunction[r.fn] ??= []).push({ skill: r.skill, n: r.n, p50: Math.round(r.p50 / 500) * 500 })

      const sizeKey = (k: string) => (SIZE_BANDS as readonly string[]).includes(k) ? SIZE_BAND_LABEL[k as SizeBand] : null
      const bySize = buildGroups(toGroupRows(size), sizeKey, 'median', likeSize).sort((a, b) => SIZE_BANDS.indexOf(a.key as SizeBand) - SIZE_BANDS.indexOf(b.key as SizeBand))
      const byScale = buildGroups(toGroupRows(scale), (k) => ((SCALE_BANDS as readonly string[]).includes(k) ? `${k} jobs open` : null), 'median', likeScale).sort(
        (a, b) => SCALE_BANDS.indexOf(a.key as (typeof SCALE_BANDS)[number]) - SCALE_BANDS.indexOf(b.key as (typeof SCALE_BANDS)[number])
      )

      return {
        computedAt: now.toISOString(),
        overall: statOf(overall),
        coverage: {
          livePostings: live.n,
          paidPostings: overall.n,
          paidWithSkills: cov.paid_skills,
          sizedShare: overall.n ? Math.round((1000 * cov.sized) / overall.n) / 1000 : 0,
        },
        byIndustry: buildGroups(toGroupRows(industry), (k) => INDUSTRY_LABEL[k] ?? null, 'median', likeIndustry),
        byFunction: buildGroups(toGroupRows(fn), (k) => (Object.values(CRAWLER_FUNCTION_LABEL).includes(k) ? k : null), 'median', likeFn),
        byLevel: buildGroups(toGroupRows(level), (k) => (k in PAY_LEVEL_LABEL ? PAY_LEVEL_LABEL[k as keyof typeof PAY_LEVEL_LABEL] : null)),
        bySize,
        byScale,
        skills,
        skillsByFunction,
      } satisfies PayData
    },
    { timeout: 280_000, maxWait: 20_000 }
  )
}

/** Once a month: how many jobs each employer with paid postings has open, so hiring growth can be measured as months accumulate. */
export async function snapshotOpenings(now = new Date()): Promise<{ month: string; employers: number; skipped: boolean }> {
  const month = now.toISOString().slice(0, 7)
  const key = `pay-data-snapshot:${month}` as const
  if (await readBoardFigure<PayDataSnapshot>(key)) return { month, employers: 0, skipped: true }
  const rows = await prisma.$queryRawUnsafe<{ id: string; n: number }[]>(`
    SELECT e."companyId" AS id, count(*)::int AS n FROM "ExclusiveJobPosting" e
    WHERE ${LIVE} AND e."companyId" IS NOT NULL GROUP BY 1 HAVING count(*) FILTER (WHERE ${PAID}) > 0`)
  await writeBoardFigure(key, { month, computedAt: now.toISOString(), open: rows.map((r) => [r.id, r.n]) } satisfies PayDataSnapshot)
  return { month, employers: rows.length, skipped: false }
}

export async function refreshPayData(): Promise<{ paid: number; skills: number; snapshot: { month: string; employers: number; skipped: boolean } }> {
  const data = await computePayData()
  await writeBoardFigure('pay-data', data)
  const snapshot = await snapshotOpenings()
  return { paid: data.overall.n, skills: data.skills.length, snapshot }
}
