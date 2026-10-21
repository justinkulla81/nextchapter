import 'server-only'
import { prisma } from '@/lib/prisma'
import { JOB_INDUSTRY_KEY_BUCKET } from '@/lib/profile/industry-reading'
import type { AiDimensions } from '@/lib/skills/ai-market'
import { buildAiDimensions, type DimCellRow, type DimShareRow } from '@/lib/skills/ai-market-dimensions'

// Same population, level mapping and pay rules as computeAiMarket (ai-market-live.ts).
const LIVE = `"status" = 'approved' AND "archivedAt" IS NULL AND "institutionScopeId" IS NULL AND COALESCE("distribution", '') <> 'EXCLUDED'
  AND ("expiresAt" IS NULL OR "expiresAt" > now()) AND COALESCE("employmentType", '') NOT IN ('internship', 'co_op', 'coop')`
const FULL = `"aiBasis" IN ('full', 'twin')`
const LEVEL = `CASE "level"
  WHEN 'ENTRY_IC' THEN 'entry' WHEN 'EARLY_IC' THEN 'early' WHEN 'MID_IC' THEN 'mid'
  WHEN 'SENIOR_IC' THEN 'senior' WHEN 'PRINCIPAL' THEN 'senior'
  WHEN 'MANAGER' THEN 'manager' WHEN 'SR_MANAGER' THEN 'manager'
  WHEN 'DIRECTOR' THEN 'director' WHEN 'HEAD' THEN 'director' WHEN 'CHIEF_OF_STAFF' THEN 'director' WHEN 'SCHOOL_LEADER' THEN 'director'
  WHEN 'VP' THEN 'vp' WHEN 'EVP_SVP' THEN 'vp' WHEN 'C_SUITE' THEN 'vp' WHEN 'PARTNER' THEN 'vp' WHEN 'BOARD' THEN 'vp' END`
const PAY = `(COALESCE("salaryMin", "salaryMax") + COALESCE("salaryMax", "salaryMin")) / 2.0 * CASE COALESCE("payPeriod", 'year')
  WHEN 'year' THEN 1 WHEN 'hour' THEN 2080 WHEN 'day' THEN 260 WHEN 'week' THEN 52 WHEN 'month' THEN 12 END`

// The crawler's industry keys as the member-facing buckets, from the one mapping the app already uses.
const quote = (v: string) => `'${v.replace(/'/g, "''")}'`
const INDUSTRY = `CASE lower(btrim("industry")) ${Object.entries(JOB_INDUSTRY_KEY_BUCKET)
  .map(([key, bucket]) => `WHEN ${quote(key)} THEN ${quote(bucket)}`)
  .join(' ')} END`
// A two-letter US state code only.
const STATE = `CASE WHEN length("locationState") = 2 THEN upper("locationState") END`

async function dimension(dimSql: string): Promise<{ shares: DimShareRow[]; cells: DimCellRow[] }> {
  const shares = await prisma.$queryRawUnsafe<DimShareRow[]>(`SELECT ${dimSql} AS k, count(*)::int AS n,
      count(*) FILTER (WHERE cardinality("aiSkillGroups") > 0)::int AS skill
    FROM "ExclusiveJobPosting" WHERE ${LIVE} AND ${FULL} AND ${dimSql} IS NOT NULL GROUP BY 1`)
  const cells = await prisma.$queryRawUnsafe<DimCellRow[]>(`WITH p AS (
      SELECT ${dimSql} AS k, "targetFunction" AS fn, ${LEVEL} AS lvl,
        CASE WHEN cardinality("aiSkillGroups") > 0 THEN 'ai' WHEN "aiMention" = false THEN 'base' END AS side,
        ${PAY} AS pay
      FROM "ExclusiveJobPosting"
      WHERE ${LIVE} AND ${FULL} AND "paySource" IN ('posted', 'text') AND ("salaryMin" IS NOT NULL OR "salaryMax" IS NOT NULL)
        AND COALESCE("payPeriod", 'year') IN ('year', 'hour', 'day', 'week', 'month')
    )
    SELECT k, fn, lvl, side, count(*)::int AS n, percentile_cont(0.5) WITHIN GROUP (ORDER BY pay)::float8 AS med,
      GROUPING(fn, lvl)::int AS g
    FROM p WHERE side IS NOT NULL AND pay BETWEEN 20000 AND 1500000 AND k IS NOT NULL AND fn IS NOT NULL AND lvl IS NOT NULL
    GROUP BY GROUPING SETS ((k, fn, lvl, side), (k, side))`)
  return { shares, cells }
}

export async function computeAiDimensions(): Promise<AiDimensions> {
  const [industry, state, level] = await Promise.all([dimension(INDUSTRY), dimension(STATE), dimension(LEVEL)])
  return buildAiDimensions({ industry, state, level })
}
