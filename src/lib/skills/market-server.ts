import 'server-only'
import { prisma } from '@/lib/prisma'
import { JOB_INDUSTRY_KEY_BUCKET } from '@/lib/profile/industry-reading'
import { US_STATES } from '@/lib/constants/us-states'
import { skillSlug } from '@/lib/rankings/awards'
import { LEVEL_LABEL, MIN_CELL, MIN_SKILL_POSTINGS, skillLabel, type SkillDimension, type SkillMarket, type SkillRow } from './market'

// The skills market recomputed from the live board (cron /api/cron/skills-market, daily after the crawler import).
// Same live population as the AI market (ai-market-live.ts). Readers take the newest snapshot, so no page scans the board.

const LIVE = `"status" = 'approved' AND "archivedAt" IS NULL AND "institutionScopeId" IS NULL AND COALESCE("distribution", '') <> 'EXCLUDED'
  AND ("expiresAt" IS NULL OR "expiresAt" > now()) AND COALESCE("employmentType", '') NOT IN ('internship', 'co_op', 'coop')`
const LEVEL = `CASE p."level"
  WHEN 'ENTRY_IC' THEN 'entry' WHEN 'EARLY_IC' THEN 'early' WHEN 'MID_IC' THEN 'mid'
  WHEN 'SENIOR_IC' THEN 'senior' WHEN 'PRINCIPAL' THEN 'senior'
  WHEN 'MANAGER' THEN 'manager' WHEN 'SR_MANAGER' THEN 'manager'
  WHEN 'DIRECTOR' THEN 'director' WHEN 'HEAD' THEN 'director' WHEN 'CHIEF_OF_STAFF' THEN 'director' WHEN 'SCHOOL_LEADER' THEN 'director'
  WHEN 'VP' THEN 'vp' WHEN 'EVP_SVP' THEN 'vp' WHEN 'C_SUITE' THEN 'vp' WHEN 'PARTNER' THEN 'vp' WHEN 'BOARD' THEN 'vp' END`
const STATE = `CASE WHEN length(p."locationState") = 2 THEN lower(p."locationState") END`
const INDUSTRY = `NULLIF(lower(btrim(p."industry")), '')`
const FRESH = `COALESCE(p."postedAt", p."createdAt") > now() - interval '30 days'`

interface CellRow {
  term: string | null
  ind: string | null
  fn: string | null
  st: string | null
  lvl: string | null
  g: number
  n: number
  fresh: number
  expo: number | null
  expo_n: number
  ai: number
}

const DIM_G: Record<string, number> = { all: 15, ind: 7, fn: 11, st: 13, lvl: 14 }
const DIM_OF_GROUP: Record<number, SkillDimension | 'all'> = { 15: 'all', 7: 'industry', 11: 'function', 13: 'state', 14: 'level' }

export async function computeSkillsMarket(now = new Date()): Promise<SkillMarket> {
  // One statement per grouping, so none runs long enough to meet a statement timeout on the pooled connection.
  const GROUPINGS = ['', 'ind', 'fn', 'st', 'lvl']
  const cells: CellRow[] = []
  for (const by of GROUPINGS) {
    const rows = await prisma.$queryRawUnsafe<CellRow[]>(`WITH b AS (
        SELECT t.term, ${INDUSTRY} AS ind, NULLIF(btrim(p."targetFunction"), '') AS fn, ${STATE} AS st, ${LEVEL} AS lvl,
          ${FRESH} AS fresh, e."observedExposure" AS expo, (cardinality(p."aiSkillGroups") > 0) AS ai
        FROM "ExclusiveJobPosting" p
        CROSS JOIN LATERAL (SELECT DISTINCT lower(btrim(x)) AS term FROM unnest(p."skills") AS x) t
        LEFT JOIN "OccupationAiExposure" e ON e.soc6 = left(p."socCode", 7)
        WHERE ${LIVE} AND cardinality(p."skills") > 0)
      SELECT term, ${by ? by : 'NULL::text'} AS ${by || 'ind'}, ${['ind', 'fn', 'st', 'lvl'].filter((c) => c !== (by || 'ind')).map((c) => `NULL::text AS ${c}`).join(', ')},
        ${DIM_G[by || 'all']}::int AS g, count(*)::int AS n,
        count(*) FILTER (WHERE fresh)::int AS fresh, avg(expo)::float8 AS expo, count(expo)::int AS expo_n,
        count(*) FILTER (WHERE ai)::int AS ai
      FROM b WHERE term <> ''
      GROUP BY term${by ? `, ${by}` : ''}
      HAVING count(*) >= ${MIN_CELL}${by ? ` AND ${by} IS NOT NULL` : ''}`)
    cells.push(...rows)
  }

  const totalRows = await prisma.$queryRawUnsafe<Omit<CellRow, 'term' | 'expo' | 'expo_n' | 'ai'>[]>(`WITH b AS (
      SELECT ${INDUSTRY} AS ind, NULLIF(btrim(p."targetFunction"), '') AS fn, ${STATE} AS st, ${LEVEL} AS lvl, ${FRESH} AS fresh
      FROM "ExclusiveJobPosting" p WHERE ${LIVE} AND cardinality(p."skills") > 0)
    SELECT ind, fn, st, lvl, GROUPING(ind, fn, st, lvl)::int AS g, count(*)::int AS n, count(*) FILTER (WHERE fresh)::int AS fresh
    FROM b GROUP BY GROUPING SETS ((), (ind), (fn), (st), (lvl))`)
  const [{ live }] = await prisma.$queryRawUnsafe<{ live: number }[]>(`SELECT count(*)::int AS live FROM "ExclusiveJobPosting" p WHERE ${LIVE}`)

  const labels: SkillMarket['labels'] = { industry: {}, function: {}, state: {}, level: { ...LEVEL_LABEL } }
  const totals: SkillMarket['totals'] = { industry: {}, function: {}, state: {}, level: {} }
  const stateName = new Map(US_STATES.map((s) => [s.code.toLowerCase(), s.name]))
  let withSkills = 0
  let fresh = 0

  const keyOf = (dim: SkillDimension, r: { ind: string | null; fn: string | null; st: string | null; lvl: string | null }): string | null => {
    if (dim === 'industry' && r.ind) {
      labels.industry[r.ind] = JOB_INDUSTRY_KEY_BUCKET[r.ind] ?? skillLabel(r.ind.replace(/_/g, ' '))
      return r.ind
    }
    if (dim === 'function' && r.fn) {
      const k = skillSlug(r.fn)
      labels.function[k] = r.fn
      return k
    }
    if (dim === 'state' && r.st) {
      const name = stateName.get(r.st)
      if (!name) return null
      labels.state[r.st] = name
      return r.st
    }
    if (dim === 'level' && r.lvl) return r.lvl
    return null
  }

  for (const r of totalRows) {
    const dim = DIM_OF_GROUP[r.g] ?? (r.g === 15 ? 'all' : undefined)
    if (dim === 'all') {
      withSkills = r.n
      fresh = r.fresh
    } else if (dim) {
      const k = keyOf(dim, r)
      if (k) totals[dim][k] = r.n
    }
  }

  const bySkill = new Map<string, SkillRow>()
  const row = (term: string): SkillRow => {
    let s = bySkill.get(term)
    if (!s) {
      s = { slug: skillSlug(term), name: skillLabel(term), n: 0, fresh: 0, exposure: null, exposureN: 0, aiPair: 0, by: { industry: {}, function: {}, state: {}, level: {} } }
      bySkill.set(term, s)
    }
    return s
  }
  for (const c of cells) {
    if (!c.term) continue
    const dim = DIM_OF_GROUP[c.g]
    if (!dim) continue
    if (dim === 'all') {
      const s = row(c.term)
      s.n = c.n
      s.fresh = c.fresh
      s.exposure = c.expo === null ? null : Math.round(c.expo * 1000) / 1000
      s.exposureN = c.expo_n
      s.aiPair = c.ai
    } else {
      const k = keyOf(dim, c)
      if (k && totals[dim][k]) row(c.term).by[dim][k] = c.n
    }
  }

  const skills = [...bySkill.values()].filter((s) => s.n >= MIN_SKILL_POSTINGS).sort((a, b) => b.n - a.n)
  return { asOf: now.toISOString(), live, withSkills, fresh, totals, labels, skills }
}

/** Compute and store a snapshot; keeps the last 30. */
export async function rebuildSkillsMarketSnapshot(computed?: SkillMarket) {
  const data = computed ?? (await computeSkillsMarket())
  await prisma.skillMarketSnapshot.create({ data: { data: data as unknown as object } })
  const old = await prisma.skillMarketSnapshot.findMany({ orderBy: { computedAt: 'desc' }, skip: 30, select: { id: true } })
  if (old.length) await prisma.skillMarketSnapshot.deleteMany({ where: { id: { in: old.map((o) => o.id) } } })
  return { live: data.live, withSkills: data.withSkills, skills: data.skills.length }
}

const TTL_MS = 30 * 60_000
let held: { at: number; data: Promise<SkillMarket | null> } | null = null

/** The newest snapshot (held per server instance for 30 minutes); null before the first run or when the table is unreadable. */
export function loadSkillsMarket(now = Date.now()): Promise<SkillMarket | null> {
  if (held && now - held.at < TTL_MS) return held.data
  const data = prisma.skillMarketSnapshot
    .findFirst({ orderBy: { computedAt: 'desc' }, select: { data: true } })
    .then((r) => {
      if (!r && held?.data === data) held.at = now - TTL_MS + 60_000
      return r ? (r.data as unknown as SkillMarket) : null
    })
    .catch((error) => {
      console.error('Skills market snapshot unavailable', error)
      return null
    })
  held = { at: now, data }
  return data
}
