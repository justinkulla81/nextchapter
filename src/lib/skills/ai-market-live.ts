import 'server-only'
import { prisma } from '@/lib/prisma'
import { CRAWLER_FUNCTION_LABEL } from '@/lib/jobs/job-functions'
import { computeEntryMarket } from '@/lib/jobs/entry-market-server'
import { computeAiDimensions } from './ai-market-dimensions-server'
import { buildAiMarket, type AiMarketCellRow, type AiMarketData, type AiMarketShareRow, type AiMarketTopRow } from './ai-market'

// The AI job market recomputed from the live board (cron /api/cron/ai-market, daily after the
// crawler import), so the AI lines members see stay current instead of the static Oct 16
// analysis. Two counts (AI-skill and AI-exposed jobs), the share asking per function, the
// posted-pay premium raw and like-for-like per function and function x level, and the AI
// skills / tools each function asks for most. Method: src/lib/skills/ai-market.ts.

const LIVE = `"status" = 'approved' AND "archivedAt" IS NULL AND "institutionScopeId" IS NULL AND COALESCE("distribution", '') <> 'EXCLUDED'
  AND ("expiresAt" IS NULL OR "expiresAt" > now()) AND COALESCE("employmentType", '') NOT IN ('internship', 'co_op', 'coop')`
const FULL = `"aiBasis" IN ('full', 'twin')`
const LEVEL = `CASE "level"
  WHEN 'ENTRY_IC' THEN 'entry' WHEN 'EARLY_IC' THEN 'early' WHEN 'MID_IC' THEN 'mid'
  WHEN 'SENIOR_IC' THEN 'senior' WHEN 'PRINCIPAL' THEN 'senior'
  WHEN 'MANAGER' THEN 'manager' WHEN 'SR_MANAGER' THEN 'manager'
  WHEN 'DIRECTOR' THEN 'director' WHEN 'HEAD' THEN 'director' WHEN 'CHIEF_OF_STAFF' THEN 'director' WHEN 'SCHOOL_LEADER' THEN 'director'
  WHEN 'VP' THEN 'vp' WHEN 'EVP_SVP' THEN 'vp' WHEN 'C_SUITE' THEN 'vp' WHEN 'PARTNER' THEN 'vp' WHEN 'BOARD' THEN 'vp' END`
// Annualized midpoint of a range the employer posted (not board-listed or estimated pay).
const PAY = `(COALESCE("salaryMin", "salaryMax") + COALESCE("salaryMax", "salaryMin")) / 2.0 * CASE COALESCE("payPeriod", 'year')
  WHEN 'year' THEN 1 WHEN 'hour' THEN 2080 WHEN 'day' THEN 260 WHEN 'week' THEN 52 WHEN 'month' THEN 12 END`

export async function computeAiMarket(now = new Date()): Promise<AiMarketData> {
  const [counts] = await prisma.$queryRawUnsafe<
    { live: number; skill: number; exposed: number; full_text: number; twin: number; excerpt: number; unread: number; skill_full: number; exposed_full: number }[]
  >(`SELECT count(*)::int AS live,
      count(*) FILTER (WHERE cardinality("aiSkillGroups") > 0)::int AS skill,
      count(*) FILTER (WHERE "aiExposed")::int AS exposed,
      count(*) FILTER (WHERE ${FULL})::int AS full_text,
      count(*) FILTER (WHERE "aiBasis" = 'twin')::int AS twin,
      count(*) FILTER (WHERE "aiBasis" = 'excerpt')::int AS excerpt,
      count(*) FILTER (WHERE "aiBasis" IS NULL)::int AS unread,
      count(*) FILTER (WHERE ${FULL} AND cardinality("aiSkillGroups") > 0)::int AS skill_full,
      count(*) FILTER (WHERE ${FULL} AND "aiExposed")::int AS exposed_full
    FROM "ExclusiveJobPosting" WHERE ${LIVE}`)

  const shares = await prisma.$queryRawUnsafe<AiMarketShareRow[]>(`SELECT "targetFunction" AS fn, count(*)::int AS n,
      count(*) FILTER (WHERE cardinality("aiSkillGroups") > 0)::int AS skill,
      count(*) FILTER (WHERE "aiExposed")::int AS exposed
    FROM "ExclusiveJobPosting" WHERE ${LIVE} AND ${FULL} AND "targetFunction" IS NOT NULL GROUP BY 1`)

  // Medians per (function, level, industry, side) and the coarser groupings, in one pass.
  // side 'ai' = asks for a specific AI skill; 'base' = no AI mention anywhere in the full text.
  const cells = await prisma.$queryRawUnsafe<AiMarketCellRow[]>(`WITH p AS (
      SELECT "targetFunction" AS fn, ${LEVEL} AS lvl, COALESCE("industry", 'unknown') AS ind,
        CASE WHEN cardinality("aiSkillGroups") > 0 THEN 'ai' WHEN "aiMention" = false THEN 'base' END AS side,
        ${PAY} AS pay
      FROM "ExclusiveJobPosting"
      WHERE ${LIVE} AND ${FULL} AND "paySource" IN ('posted', 'text') AND ("salaryMin" IS NOT NULL OR "salaryMax" IS NOT NULL)
        AND COALESCE("payPeriod", 'year') IN ('year', 'hour', 'day', 'week', 'month')
    )
    SELECT fn, lvl, ind, side, count(*)::int AS n, percentile_cont(0.5) WITHIN GROUP (ORDER BY pay)::float8 AS med,
      GROUPING(fn, lvl, ind)::int AS g
    FROM p WHERE side IS NOT NULL AND pay BETWEEN 20000 AND 1500000 AND fn IS NOT NULL AND lvl IS NOT NULL
    GROUP BY GROUPING SETS ((fn, lvl, ind, side), (fn, lvl, side), (fn, side), (side))`)

  const items = await prisma.$queryRawUnsafe<AiMarketTopRow[]>(`SELECT "targetFunction" AS fn, x AS key, count(*)::int AS n
    FROM "ExclusiveJobPosting", unnest("aiSkillItems") AS x
    WHERE ${LIVE} AND cardinality("aiSkillItems") > 0 AND "targetFunction" IS NOT NULL GROUP BY 1, 2`)
  const tools = await prisma.$queryRawUnsafe<AiMarketTopRow[]>(`SELECT "targetFunction" AS fn, x AS key, count(*)::int AS n
    FROM "ExclusiveJobPosting", unnest("aiToolsNamed") AS x
    WHERE ${LIVE} AND cardinality("aiSkillGroups") > 0 AND "targetFunction" IS NOT NULL GROUP BY 1, 2`)

  // Industry, state and level breakdowns. Never let them fail the snapshot.
  const dimensions = await computeAiDimensions().catch((error) => {
    console.error('AI market dimensions failed', error)
    return undefined
  })

  const market = buildAiMarket({
    asOf: now.toISOString(),
    counts: {
      live: counts.live,
      aiSkill: counts.skill,
      aiExposed: counts.exposed,
      fullText: counts.full_text,
      twin: counts.twin,
      excerpt: counts.excerpt,
      unread: counts.unread,
      aiSkillFullText: counts.skill_full,
      aiExposedFullText: counts.exposed_full,
    },
    shares,
    cells,
    items,
    tools,
    functionLabels: CRAWLER_FUNCTION_LABEL,
  })
  // Entry-level numbers (entry-market-server.ts). Never let them fail the snapshot.
  const entry = await computeEntryMarket().catch((error) => {
    console.error('AI market entry-level numbers failed', error)
    return undefined
  })
  return { ...market, ...(dimensions ? { dimensions } : {}), ...(entry ? { entry } : {}) }
}

/** Compute and store a snapshot; keeps the last 60. */
export async function rebuildAiMarketSnapshot(computed?: AiMarketData) {
  const data = computed ?? (await computeAiMarket())
  await prisma.aiMarketSnapshot.create({ data: { data: data as object } })
  const old = await prisma.aiMarketSnapshot.findMany({ orderBy: { computedAt: 'desc' }, skip: 60, select: { id: true } })
  if (old.length) await prisma.aiMarketSnapshot.deleteMany({ where: { id: { in: old.map((o) => o.id) } } })
  return { counts: data.counts, overall: data.overall, functions: Object.keys(data.functions).length }
}

const TTL_MS = 30 * 60_000
let held: { at: number; data: Promise<AiMarketData | null> } | null = null

/** The newest snapshot (held per server instance for 30 minutes); null before the first run. */
export function loadAiMarket(now = Date.now()): Promise<AiMarketData | null> {
  if (held && now - held.at < TTL_MS) return held.data
  const data = prisma.aiMarketSnapshot
    .findFirst({ orderBy: { computedAt: 'desc' }, select: { data: true } })
    .then((r) => {
      // No snapshot yet: look again in a minute rather than holding "none" for 30.
      if (!r && held?.data === data) held.at = now - TTL_MS + 60_000
      return r ? (r.data as unknown as AiMarketData) : null
    })
    .catch((error) => {
      console.error('AI market snapshot unavailable', error)
      return null
    })
  held = { at: now, data }
  return data
}
