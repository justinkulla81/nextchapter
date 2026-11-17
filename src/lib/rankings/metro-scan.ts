import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PUBLIC_JOB_LIVE_SQL, PUBLIC_JOB_STATIC_SQL } from '@/lib/jobs/public-job-page-server'
import { AEI_OBSERVED_EXPOSURE } from '@/lib/market/aei-observed-exposure'
import { naicsSector } from '@/lib/workforce/sector'
import { cityFromAddress, placeKey, placeKeys } from '@/lib/workforce/places'
import type { CountyFacts, WcCounts } from '@/lib/rankings/metro-places'

// The reads behind the best-places-for-white-collar-professionals lists. They run only in the monthly rankings job
// (/api/cron/rankings, group "metro"), never on a page view. Rows returned per run: about 10,000 city groups (~120 B each), 3,144
// counties (~80 B, plus the college list, ~1 KB), ~3,500 layoff notices (~150 B) and ~3,000 job-center counts: under 6 MB of egress a month.

const PAID = Prisma.sql`"salaryMin" IS NOT NULL AND "salaryMax" >= "salaryMin" AND "payPeriod" = 'year' AND "salaryMin" >= 20000 AND "salaryMax" < 2000000 AND COALESCE("salaryCurrency", 'USD') = 'USD'`
const SOC2 = Prisma.sql`left(regexp_replace(coalesce("socCode", ''), '\\D', '', 'g'), 2)`
/** White collar: an occupation code in Census groups 1 and 2 (SOC 11 to 29), or no code and a professional job family. */
const WHITE = Prisma.sql`(${SOC2} BETWEEN '11' AND '29' OR (${SOC2} = '' AND "targetFunction" IS NOT NULL AND "targetFunction" NOT IN ('Administration', 'Sales', 'Customer Success')))`
const AI_CASE = Prisma.sql`CASE ${SOC2} ${Prisma.join(Object.entries(AEI_OBSERVED_EXPOSURE).map(([soc, x]) => Prisma.sql`WHEN ${soc} THEN ${x.exposure}::float`), ' ')} END`

async function longRead<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '600s'`)
    return run(tx)
  }, { timeout: 620_000, maxWait: 30_000 })
}

/** The white-collar openings query: one row per (state, city). Exported so its SQL can be checked on its own. */
export const whiteCollarCitySql = () => Prisma.sql`
    SELECT "locationState" AS st, lower("locationCity") AS city, count(*)::int AS n,
      count(*) FILTER (WHERE ${PAID})::int AS paid,
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY ("salaryMin" + "salaryMax") / 2.0) FILTER (WHERE ${PAID}))::float AS pay_med,
      count(*) FILTER (WHERE "workArrangement" IN ('remote', 'hybrid'))::int AS flex,
      count(*) FILTER (WHERE ${PAID} AND cardinality("aiSkillGroups") > 0)::int AS ai_paid,
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY ("salaryMin" + "salaryMax") / 2.0) FILTER (WHERE ${PAID} AND cardinality("aiSkillGroups") > 0))::float AS ai_pay_med,
      count(*) FILTER (WHERE ${PAID} AND cardinality("aiSkillGroups") = 0)::int AS plain_paid,
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY ("salaryMin" + "salaryMax") / 2.0) FILTER (WHERE ${PAID} AND cardinality("aiSkillGroups") = 0))::float AS plain_pay_med,
      count(*) FILTER (WHERE ${SOC2} BETWEEN '11' AND '29')::int AS soc_n,
      (sum(${AI_CASE}) FILTER (WHERE ${SOC2} BETWEEN '11' AND '29'))::float AS ai_sum
    FROM "ExclusiveJobPosting"
    WHERE ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL} AND "locationState" IS NOT NULL AND "locationCity" IS NOT NULL AND ${WHITE}
    GROUP BY 1, 2`

/** White-collar openings by county: one pass over the live board grouped by city, each city placed in its county. */
export async function loadWhiteCollarByCounty(placeCounty: Record<string, string>): Promise<Map<string, WcCounts>> {
  const rows = await longRead((tx) => tx.$queryRaw<{ st: string; city: string; n: number; paid: number; pay_med: number | null; flex: number; ai_paid: number; ai_pay_med: number | null; plain_paid: number; plain_pay_med: number | null; soc_n: number; ai_sum: number | null }[]>(whiteCollarCitySql()))
  const out = new Map<string, WcCounts>()
  for (const r of rows) {
    const fips = placeKeys(r.city).map((k) => placeCounty[`${r.st}|${k}`]).find(Boolean)
    if (!fips) continue
    const cur = out.get(fips) ?? { n: 0, paid: 0, pay: [], flex: 0, aiPay: [], plainPay: [], socN: 0, aiSum: 0 }
    cur.n += r.n; cur.paid += r.paid; cur.flex += r.flex; cur.socN += r.soc_n; cur.aiSum += r.ai_sum ?? 0
    if (r.pay_med != null && r.paid > 0) cur.pay.push([r.pay_med, r.paid])
    if (r.ai_pay_med != null && r.ai_paid > 0) cur.aiPay.push([r.ai_pay_med, r.ai_paid])
    if (r.plain_pay_med != null && r.plain_paid > 0) cur.plainPay.push([r.plain_pay_med, r.plain_paid])
    out.set(fips, cur)
  }
  return out
}

/** Industries whose layoffs are mostly blue-collar work: their notices are left out of the white-collar layoff count. */
const BLUE_SECTORS = new Set(['11', '21', '22', '23', '31', '32', '33', '42', '44', '45', '48', '49', '72'])

/** Public two-year colleges in a county's college list (GeoArea.higherEd: [{ level, control, ... }]). */
const communityColleges = (list: unknown) => (Array.isArray(list) ? list.filter((c) => c && typeof c === 'object' && (c as { level?: string }).level === '2-year' && (c as { control?: string }).control === 'Public').length : 0)

const countyKey = (s: string) => s.toLowerCase().replace(/\b(county|parish|borough|census area|municipality|city and borough)\b/g, '').replace(/[^a-z0-9]/g, '')

/**
 * Workers in WARN notices of the last 12 months by county, blue-collar notices left out (by the notice's own collar tag, else its
 * industry). A notice is placed by the county it names, else by the city in its address; one naming several counties is split.
 */
export async function loadWhiteCollarLayoffs(counties: { fips: string; st: string; name: string }[], placeCounty: Record<string, string>): Promise<{ byCounty: Map<string, number>; unplacedByState: Map<string, number>; states: Set<string>; placed: number; unplaced: number; blue: number }> {
  const since = new Date(Date.now() - 365 * 86_400_000)
  const rows = await prisma.warnNotice.findMany({
    where: { dismissedAt: null, state: { not: null }, OR: [{ noticeDate: { gte: since } }, { effectiveDate: { gte: since } }] },
    select: { state: true, county: true, address: true, employees: true, industry: true, workCollar: true },
  })
  const byName = new Map(counties.map((c) => [`${c.st}|${countyKey(c.name)}`, c.fips]))
  const out = new Map<string, number>()
  const unplacedByState = new Map<string, number>()
  const states = new Set<string>()
  let placed = 0, unplaced = 0, blue = 0
  for (const n of rows) {
    const st = n.state as string
    states.add(st)
    const sector = naicsSector(n.industry)
    if (n.workCollar === 'blue' || (n.workCollar !== 'white' && sector && BLUE_SECTORS.has(sector))) { blue++; continue }
    let hit = (n.county ?? '').split(/[,;/&]| and /i).map((c) => byName.get(`${st}|${countyKey(c)}`)).filter((f): f is string => !!f)
    if (!hit.length) {
      const city = cityFromAddress(n.address, st)
      const f = city ? [placeKey(city), ...placeKeys(city)].map((k) => placeCounty[`${st}|${k}`]).find(Boolean) : undefined
      if (f) hit = [f]
    }
    if (!hit.length) { unplaced++; unplacedByState.set(st, (unplacedByState.get(st) ?? 0) + (n.employees ?? 0)); continue }
    placed++
    for (const f of hit) out.set(f, (out.get(f) ?? 0) + (n.employees ?? 0) / hit.length)
  }
  return { byCounty: out, unplacedByState, states, placed, unplaced, blue }
}

/** Each county's public figures, its American Job Centers and its white-collar layoffs. */
export async function loadCountyFacts(placeCounty: Record<string, string>): Promise<{ facts: Map<string, CountyFacts & { st: string; name: string }>; layoffNote: { placed: number; unplaced: number; blue: number } }> {
  const [areas, centers, orgRows] = await Promise.all([
    prisma.geoArea.findMany({ where: { level: 'COUNTY' }, select: { id: true, state: true, name: true, population: true, laborForce: true, whiteCollarShare: true, wcUnemploymentEst: true, higherEdCount: true, higherEdEnrollmentEst: true, higherEd: true } }),
    prisma.americanJobCenter.groupBy({ by: ['countyFips'], _count: { _all: true } }),
    prisma.geoOrgLead.groupBy({ by: ['geoAreaId'], where: { kind: { in: ['ECON_DEV', 'JOB_TRAINING', 'WORKFORCE'] }, geoAreaId: { not: null } }, _count: { _all: true } }),
  ])
  const orgs = new Map(orgRows.flatMap((r) => (r.geoAreaId ? [[r.geoAreaId, r._count._all] as const] : [])))
  const ajc = new Map(centers.flatMap((c) => (c.countyFips ? [[c.countyFips, c._count._all] as const] : [])))
  const layoffs = await loadWhiteCollarLayoffs(areas.map((a) => ({ fips: a.id, st: a.state, name: a.name })), placeCounty)
  // A notice with no county or city we can place is shared across its state's counties by their white-collar workers, so a state
  // whose filings omit the place does not read as layoff-free. A state with no notices at all is unknown, not zero.
  const wcOf = (a: (typeof areas)[number]) => (a.laborForce ?? 0) * (a.whiteCollarShare ?? 0)
  const stateWc = new Map<string, number>()
  for (const a of areas) stateWc.set(a.state, (stateWc.get(a.state) ?? 0) + wcOf(a))
  const facts = new Map(areas.map((a) => [a.id, {
    st: a.state, name: a.name, population: a.population, laborForce: a.laborForce, whiteCollarShare: a.whiteCollarShare, wcUnemp: a.wcUnemploymentEst,
    colleges: a.higherEdCount, enrollment: a.higherEdEnrollmentEst, communityColleges: communityColleges(a.higherEd), supportOrgs: orgs.get(a.id) ?? 0, ajc: ajc.get(a.id) ?? 0,
    layoffWorkers: layoffs.states.has(a.state)
      ? (layoffs.byCounty.get(a.id) ?? 0) + ((layoffs.unplacedByState.get(a.state) ?? 0) * wcOf(a)) / Math.max(1, stateWc.get(a.state) ?? 0)
      : null,
  }]))
  return { facts, layoffNote: { placed: layoffs.placed, unplaced: layoffs.unplaced, blue: layoffs.blue } }
}

/** Open state retraining, job-seeker support and relocation programs in the benefits catalog, by state. */
export async function loadStatePrograms(): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ state: string; n: number }[]>`
    SELECT "state", count(*)::int AS n FROM "BenefitProgram"
    WHERE "state" IS NOT NULL AND "status" IN ('OPEN', 'ROLLING') AND "category" IN ('STATE_TRAINING', 'SUPPORT', 'RELOCATION') AND "name" NOT LIKE '(none%'
    GROUP BY 1`
  return new Map(rows.map((r) => [r.state, r.n]))
}

/**
 * Median annual wage of each white-collar occupation (SOC 11 to 29) in each metro, with its employment, from BLS Occupational
 * Employment and Wage Statistics (OccupationWage, newest year). About 35,000 narrow rows a month.
 */
export async function loadMetroWages(): Promise<Map<string, [number, number][]>> {
  const rows = await prisma.$queryRaw<{ area: string; wage: number; emp: number }[]>`
    SELECT "areaCode" AS area, "wageMedian" AS wage, "employment" AS emp FROM "OccupationWage"
    WHERE "areaType" = 'METRO' AND "year" = (SELECT max("year") FROM "OccupationWage" WHERE "areaType" = 'METRO')
      AND left("soc6", 2) BETWEEN '11' AND '29' AND "wageMedian" IS NOT NULL AND "employment" > 0`
  const out = new Map<string, [number, number][]>()
  for (const r of rows) out.set(r.area, [...(out.get(r.area) ?? []), [r.wage, r.emp]])
  return out
}
