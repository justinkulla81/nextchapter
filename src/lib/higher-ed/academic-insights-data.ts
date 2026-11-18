import 'server-only'
import { cache } from 'react'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { heavy, memoTtl, sharedLoad } from '@/lib/db/heavy'
import { PUBLIC_JOB_LIVE_SQL, PUBLIC_JOB_STATIC_SQL } from '@/lib/jobs/public-job-page-server'
import { getStateCityPlaces } from '@/lib/places/places'
import { countyKey } from '@/lib/workforce/places'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { readProfile, regionAreas } from '@/lib/higher-ed/profile'
import { collegeRecord } from '@/lib/higher-ed/peers'
import { getAlumniSkills, getAlumniWork } from '@/lib/higher-ed/views'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { bridgeOfferings } from '@/lib/higher-ed/skills-bridge'
import { loadSkillsMarket } from '@/lib/skills/market-server'
import { hotSkills, skillsIn, type SkillMarket } from '@/lib/skills/market'
import { loadExposureMap } from '@/lib/skills/ai-exposure-server'
import { exposureFor } from '@/lib/skills/ai-exposure'
import { getTitleIndex } from '@/lib/careers/taxonomy'
import { matchTitle } from '@/lib/careers/title-match'
import { educationRows } from '@/lib/rankings/degrees-specs'
import { loadProgramsMarket } from '@/lib/higher-ed/programs-market-data'
import {
  alumniAtRisk, employerInsights, retrainingDemand, riskKeys, skillGaps,
  type AlumniAtRisk, type DemandSkill, type EmployerInsight, type EmployerSignal, type FunctionGaps, type LayoffHit, type RegionEmployerRow, type RetrainingDemand, type RoleExposure,
} from '@/lib/higher-ed/academic-insights'

// The reads behind the Academic Affairs insights. No scan on a page view beyond one shared county read:
//   - employers near the college: one statement per county of its region, shared across instances for six hours;
//   - alumni (consent-gated views, counts only), their employers' companies and weekly signals (by name and id), layoff
//     matches (refreshed nightly): held per college for 30 minutes;
//   - skills: the daily skills-market snapshot; exposure: the cached occupation tables.

const PAID = Prisma.sql`"salaryMin" IS NOT NULL AND "salaryMax" >= "salaryMin" AND "payPeriod" = 'year' AND "salaryMin" >= 20000 AND "salaryMax" < 2000000 AND COALESCE("salaryCurrency", 'USD') = 'USD'`

/** The four-year-degree occupations and the degree field each leads from, as a joinable list. */
function fieldMapping() {
  const values = educationRows().filter((r) => r.fld).map((r) => Prisma.sql`(${r.soc}::text, ${r.fld}::text)`)
  return Prisma.sql`(VALUES ${Prisma.join(values)}) AS m(soc, fld)`
}

/** The newest week of company signals, for the trend of a set of companies. */
async function latestSignals(companyIds: string[]): Promise<Map<string, { openNow: number; open4wAgo: number }>> {
  if (companyIds.length === 0) return new Map()
  const rows = await prisma.$queryRaw<{ companyId: string; open: number; d4: number }[]>`
    SELECT s."companyId", s."openRolesTotal" AS open, s."rolesDelta4wk" AS d4 FROM "CompanySignal" s
    WHERE s."companyId" = ANY(${companyIds}) AND s."weekStartDate" = (SELECT max("weekStartDate") FROM "CompanySignal")`
  return new Map(rows.map((r) => [r.companyId, { openNow: r.open, open4wAgo: r.open - r.d4 }]))
}

/** One county's employers: open professional roles, entry level, roles by degree field, posted pay, layoffs filed. */
async function loadCountyEmployers(state: string, spellings: string[]): Promise<RegionEmployerRow[]> {
  const where = Prisma.sql`WHERE ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL} AND "locationState" = ${state} AND lower("locationCity") = ANY(${spellings})`
  const rows = await heavy(() => prisma.$queryRaw<{ name: string; cid: string | null; cn: string | null; n: number; entry: number; paid: number; pay: number | null; fields: Record<string, number> | null; warn: number | null; lastwarn: Date | null }[]>`
    WITH c AS MATERIALIZED (
      SELECT "companyName", "companyId", level, left("socCode", 7) AS soc, "salaryMin", "salaryMax", (${PAID}) AS paid FROM "ExclusiveJobPosting" ${where}
        AND "companyName" !~* '^(confidential|undisclosed|stealth)'
    ),
    e AS (
      SELECT "companyName" AS name, "companyId" AS cid, count(*)::int AS n, count(*) FILTER (WHERE level IN ('ENTRY_IC', 'EARLY_IC'))::int AS entry,
        count(*) FILTER (WHERE paid)::int AS paid,
        (percentile_cont(0.5) WITHIN GROUP (ORDER BY ("salaryMin" + "salaryMax") / 2.0) FILTER (WHERE paid))::float AS pay
      FROM c GROUP BY 1, 2 ORDER BY n DESC, name LIMIT 40
    ),
    f AS (
      SELECT c."companyName" AS name, c."companyId" AS cid, m.fld, count(*)::int AS n
      FROM c JOIN ${fieldMapping()} ON m.soc = c.soc
      WHERE (c."companyName", c."companyId") IN (SELECT name, cid FROM e) OR (c."companyId" IS NULL AND c."companyName" IN (SELECT name FROM e WHERE cid IS NULL))
      GROUP BY 1, 2, 3
    )
    SELECT e.name, e.cid, co."canonicalNameNormalized" AS cn, e.n, e.entry, e.paid, e.pay,
      (SELECT json_object_agg(f.fld, f.n) FROM f WHERE f.name = e.name AND f.cid IS NOT DISTINCT FROM e.cid) AS fields,
      p."warnFilings12mo" AS warn, p."lastWarnAt" AS lastwarn
    FROM e LEFT JOIN "Company" co ON co.id = e.cid LEFT JOIN "CompanyHiringProfile" p ON p."companyId" = e.cid`)
  const signals = await latestSignals(rows.flatMap((r) => (r.cid ? [r.cid] : [])))
  return rows.map((r) => ({
    name: r.name, companyId: r.cid, cn: r.cn, open: r.n, entry: r.entry, fields: r.fields ?? {}, paid: r.paid, payMed: r.pay,
    openNow: r.cid ? signals.get(r.cid)?.openNow ?? null : null, open4wAgo: r.cid ? signals.get(r.cid)?.open4wAgo ?? null : null,
    warn12mo: r.warn ?? 0, lastWarnAt: r.lastwarn ? new Date(r.lastwarn).toISOString().slice(0, 10) : null,
  }))
}

const countyEmployers = memoTtl(30 * 60_000, (state: string, county: string) => `${state}|${county}`, async (state: string, county: string): Promise<RegionEmployerRow[]> => {
  const key = countyKey(county)
  const places = (await getStateCityPlaces(state)).filter((p) => p.county && countyKey(p.county) === key)
  const spellings = [...new Set(places.flatMap((p) => [p.key, p.name.toLowerCase()]))]
  if (spellings.length === 0) return []
  return sharedLoad(`academic-county-employers-v1:${state}|${key}`, 6 * 60 * 60, () => loadCountyEmployers(state, spellings))
})

export interface RegionInfo { label: string; counties: { state: string; county: string }[] }

/** The college's region: the counties on its profile, or the county of its federal record. */
async function regionOf(institution: { name: string; profile: unknown }): Promise<RegionInfo | null> {
  const profile = readProfile(institution.profile)
  const areas = regionAreas(profile.region)
  if (areas.length > 0) {
    const counties = areas.flatMap((a) => a.counties.map((county) => ({ state: a.state, county })))
    if (counties.length > 0) return { label: profile.region?.name ?? counties.map((c) => c.county).join(', '), counties }
  }
  const record = await collegeRecord(institution)
  if (!record) return null
  const local = await prisma.localCollege.findUnique({ where: { id: record.unitid }, select: { countyFips: true, state: true, city: true } })
  if (!local?.countyFips) return null
  const county = await prisma.geoPlace.findFirst({ where: { state: local.state, county: { not: null } , name: { equals: local.city ?? '', mode: 'insensitive' } }, select: { county: true } })
  return county?.county ? { label: county.county, counties: [{ state: local.state, county: county.county }] } : null
}

const institutionOf = cache(async (id: string) =>
  prisma.institution.findUniqueOrThrow({ where: { id }, select: { id: true, slug: true, name: true, profile: true, enabledFeatures: true } }))

export interface EmployersNearby { region: RegionInfo; employers: EmployerInsight[]; yourFields: string[] }

export const loadEmployersNearby = cache(async (ctx: WorkspaceContext): Promise<EmployersNearby | null> => {
  const inst = await institutionOf(ctx.institution.id)
  const region = await regionOf(inst)
  if (!region) return null
  const [rows, programs] = await Promise.all([
    Promise.all(region.counties.map((c) => countyEmployers(c.state, c.county).catch(() => [] as RegionEmployerRow[]))),
    loadProgramsMarket(inst).catch(() => null),
  ])
  // The fields its graduates go into: every degree field its majors lead to.
  const yourFields = programs?.ok ? [...new Set(programs.data.rows.flatMap((r) => (r.major.field ? [r.major.field] : [])))] : []
  const record = await collegeRecord(inst).catch(() => null)
  const selfNames = [inst.name, record?.name].filter((n): n is string => !!n)
  return { region, employers: employerInsights(rows.flat(), new Set(yourFields), 25, selfNames), yourFields }
})

// ---- Alumni at risk and retraining ---------------------------------------------------------------------------------------

/** Companies and their newest weekly signal and 12-month layoffs, for the normalized names alumni work at. */
async function employerSignals(keys: string[]): Promise<Map<string, EmployerSignal>> {
  if (keys.length === 0) return new Map()
  const companies = await prisma.company.findMany({ where: { canonicalNameNormalized: { in: keys.slice(0, 2000) } }, select: { id: true, name: true, canonicalNameNormalized: true } })
  const [signals, profiles] = await Promise.all([
    latestSignals(companies.map((c) => c.id)),
    prisma.companyHiringProfile.findMany({ where: { companyId: { in: companies.map((c) => c.id) } }, select: { companyId: true, warnFilings12mo: true, warnEmployees12mo: true, lastWarnAt: true } }),
  ])
  const profileBy = new Map(profiles.map((p) => [p.companyId, p]))
  return new Map(companies.map((c) => {
    const s = signals.get(c.id)
    const p = profileBy.get(c.id)
    return [c.canonicalNameNormalized, { name: c.name, openNow: s?.openNow ?? null, open4wAgo: s?.open4wAgo ?? null, warn12mo: p?.warnFilings12mo ?? 0, warnEmployees12mo: p?.warnEmployees12mo ?? 0, lastWarnAt: p?.lastWarnAt ? p.lastWarnAt.toISOString().slice(0, 10) : null }]
  }))
}

async function layoffHits(institutionId: string): Promise<LayoffHit[]> {
  const since = new Date(Date.now() - 365 * 86_400_000)
  const rows = await prisma.layoffMatch.findMany({
    where: { institutionId, matchedAt: { gte: since } },
    select: { isSampleData: true, member: { select: { lastKnownEmployer: true } }, warnNotice: { select: { id: true, employer: true, noticeDate: true, employees: true, county: true, state: true } } },
    take: 5000,
  })
  const byNotice = new Map<string, LayoffHit & { keys: Set<string> }>()
  for (const r of rows) {
    const w = r.warnNotice
    const hit = byNotice.get(w.id) ?? {
      employerKey: normalizeOrgName(w.employer), employer: w.employer, noticeDate: w.noticeDate ? w.noticeDate.toISOString().slice(0, 10) : null,
      employees: w.employees, where: [w.county, w.state].filter(Boolean).join(', ') || null, alumni: 0, sample: r.isSampleData, keys: new Set<string>(),
    }
    hit.alumni += 1
    // The members' own spelling of the employer, so the hit finds them however the filing names it.
    if (r.member.lastKnownEmployer) hit.keys.add(normalizeOrgName(r.member.lastKnownEmployer))
    byNotice.set(w.id, hit)
  }
  return [...byNotice.values()].flatMap(({ keys, ...h }) => [h, ...[...keys].filter((k) => k !== h.employerKey).map((k) => ({ ...h, employerKey: k }))])
}

async function roleExposures(work: { employer: string | null; title: string | null }[]): Promise<RoleExposure[]> {
  const [index, exposure] = await Promise.all([getTitleIndex(), loadExposureMap()])
  const memo = new Map<string, { occupation: string | null; score: number | null }>()
  return work.flatMap((w): RoleExposure[] => {
    if (!w.title) return []
    const t = w.title.trim().toLowerCase()
    let hit = memo.get(t)
    if (!hit) {
      const m = index ? matchTitle(index, w.title, 3) : null
      const soc = m && (m.kind === 'EXACT' || m.kind === 'FUZZY') ? m.candidates[0]?.socCode : null
      const e = soc ? exposureFor(soc, exposure) : null
      hit = { occupation: e?.title ?? null, score: e?.score ?? null }
      memo.set(t, hit)
    }
    return [{ title: w.title, ...hit, employerKey: w.employer ? normalizeOrgName(w.employer) : null }]
  })
}

/** The snapshot's skills for a function, matched by its label as candidate profiles write it. */
function demandFor(market: SkillMarket) {
  const hot = new Set(hotSkills(market, 60).map((s) => s.slug))
  const keyByLabel = new Map(Object.entries(market.labels.function ?? {}).map(([k, label]) => [label.toLowerCase(), k]))
  return (fn: string) => {
    const key = keyByLabel.get(fn.toLowerCase()) ?? (market.totals.function?.[fn] != null ? fn : null)
    if (!key) return null
    const skills: DemandSkill[] = skillsIn(market, 'function', key, 12).map((s) => ({ slug: s.slug, name: s.name, share: s.share / 100, rising: hot.has(s.slug), ai: s.n > 0 && s.aiPair / s.n >= 0.25 }))
    return { postings: market.totals.function?.[key] ?? 0, skills }
  }
}

export interface AlumniInsights { atRisk: AlumniAtRisk; gaps: FunctionGaps[]; retraining: RetrainingDemand; skillsAsOf: string | null }

const alumniInsights = memoTtl(30 * 60_000, (ctx: WorkspaceContext) => ctx.institution.id, async (ctx: WorkspaceContext): Promise<AlumniInsights> => {
  const inst = await institutionOf(ctx.institution.id)
  const [work, skills, layoffs, market, offerings] = await Promise.all([
    getAlumniWork(ctx), getAlumniSkills(ctx), layoffHits(ctx.institution.id), loadSkillsMarket().catch(() => null), bridgeOfferings(inst, inst.enabledFeatures).catch(() => []),
  ])
  const keys = [...new Set(work.flatMap((w) => (w.employer ? [normalizeOrgName(w.employer)] : [])))].filter(Boolean)
  const [signals, roles] = await Promise.all([employerSignals(keys), roleExposures(work)])
  const atRisk = alumniAtRisk(work, signals, layoffs)
  const gaps = market ? skillGaps(skills, demandFor(market)) : []
  const retraining = retrainingDemand(roles, riskKeys(atRisk), gaps, offerings.map((o) => ({ name: o.name, kind: o.kind, href: o.href, skills: o.skills })))
  return { atRisk, gaps, retraining, skillsAsOf: market?.asOf ?? null }
})

/** One read per request; the college's figures are held 30 minutes per instance. */
export const loadAlumniInsights = cache((ctx: WorkspaceContext) => alumniInsights(ctx))
