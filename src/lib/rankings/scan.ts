import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PUBLIC_JOB_LIVE_SQL, PUBLIC_JOB_STATIC_SQL } from '@/lib/jobs/public-job-page-server'
import { loadCountyContext } from '@/lib/workforce/county-context-data'
import { COUNTY_SECTORS } from '@/lib/workforce/county-context'
import { slugify } from '@/lib/seo/workforce-pages'
import { stateName, stateSlug as stateSlugOf } from '@/lib/seo/states'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { industryByName, bucketFromIndustryText } from '@/lib/seo/topics'
import type { CityStat, CountyStat, FnTotal, IndustryStat, SkillStat } from '@/lib/rankings/types'

// The two reads behind the rankings. Both are whole-board work, so they run only in the monthly job (/api/cron/rankings)
// and never on a page view.

const PAID = Prisma.sql`"salaryMin" IS NOT NULL AND "salaryMax" >= "salaryMin" AND "payPeriod" = 'year' AND "salaryMin" >= 20000 AND "salaryMax" < 2000000 AND COALESCE("salaryCurrency", 'USD') = 'USD'`
const WHERE = Prisma.sql`WHERE ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL} AND "locationState" IS NOT NULL AND "locationCity" IS NOT NULL`
const MIN_EMPLOYER_ROLES = 5

/** The default statement timeout is far shorter than a whole-board group-by needs; this raises it for one transaction only. */
async function longRead<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '600s'`)
    return run(tx)
  }, { timeout: 620_000, maxWait: 30_000 })
}

interface CityRow { st: string; city: string; n: number; entry: number; ai: number; remote: number; paid: number; pay_med: number | null; eng: number; eng_paid: number; eng_pay: number | null; mid: number; exec: number }

/** Open professional roles by city: the counts every city measure is built from, and each city's top three employers. */
export async function loadCityStats(): Promise<CityStat[]> {
  // The two reads are independent whole-board passes: run them side by side, which roughly halves the job's time.
  const [rows, emp] = await Promise.all([
    longRead((tx) => tx.$queryRaw<CityRow[]>`
    SELECT "locationState" AS st, lower("locationCity") AS city, count(*)::int AS n,
      count(*) FILTER (WHERE level IN ('ENTRY_IC', 'EARLY_IC'))::int AS entry,
      count(*) FILTER (WHERE cardinality("aiSkillGroups") > 0)::int AS ai,
      count(*) FILTER (WHERE "workArrangement" = 'remote')::int AS remote,
      count(*) FILTER (WHERE ${PAID})::int AS paid,
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY ("salaryMin" + "salaryMax") / 2.0) FILTER (WHERE ${PAID}))::float AS pay_med,
      count(*) FILTER (WHERE "targetFunction" = 'Engineering')::int AS eng,
      count(*) FILTER (WHERE level IN ('MID_IC', 'SENIOR_IC', 'MANAGER'))::int AS mid,
      count(*) FILTER (WHERE level IN ('DIRECTOR', 'SR_MANAGER', 'VP', 'C_SUITE', 'HEAD'))::int AS exec,
      count(*) FILTER (WHERE "targetFunction" = 'Engineering' AND ${PAID})::int AS eng_paid,
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY ("salaryMin" + "salaryMax") / 2.0) FILTER (WHERE "targetFunction" = 'Engineering' AND ${PAID}))::float AS eng_pay
    FROM "ExclusiveJobPosting" ${WHERE}
    GROUP BY 1, 2
    HAVING count(*) >= 30`),
    longRead((tx) => tx.$queryRaw<{ st: string; city: string; co: string; n: number }[]>`
    SELECT "locationState" AS st, lower("locationCity") AS city, "companyName" AS co, count(*)::int AS n
    FROM "ExclusiveJobPosting" ${WHERE}
    GROUP BY 1, 2, 3
    HAVING count(*) >= ${MIN_EMPLOYER_ROLES}`),
  ])
  // One employer posts under several spellings ("UnitedHealth Group", "Unitedhealth Group"): count them as one, and show the commonest.
  const top = new Map<string, Map<string, { names: Map<string, number>; n: number }>>()
  for (const e of emp) {
    const k = `${e.st}|${e.city}`
    const byEmployer = top.get(k) ?? new Map()
    const key = normalizeOrgName(e.co) || e.co.toLowerCase()
    const cur = byEmployer.get(key) ?? { names: new Map<string, number>(), n: 0 }
    cur.n += e.n
    cur.names.set(e.co, (cur.names.get(e.co) ?? 0) + e.n)
    byEmployer.set(key, cur)
    top.set(k, byEmployer)
  }
  const topOf = (k: string) => [...(top.get(k)?.values() ?? [])].sort((a, b) => b.n - a.n).map((x) => ({ n: x.n, name: [...x.names].sort((a, b) => b[1] - a[1])[0][0] }))
  // A posting whose "city" is the state's own name ("Florida, FL") names no city.
  const notACity = (r: CityRow) => r.city === stateName(r.st).toLowerCase() && r.st !== 'NY' && r.st !== 'DC'
  return rows.filter((r) => !notACity(r)).map((r) => {
    const employers = topOf(`${r.st}|${r.city}`)
    return {
      st: r.st, city: r.city, n: r.n, entry: r.entry, ai: r.ai, remote: r.remote, paid: r.paid, payMed: r.pay_med, eng: r.eng, engPaid: r.eng_paid, engPay: r.eng_pay, mid: r.mid, exec: r.exec,
      employers: employers.slice(0, 3).map((x) => x.name), topShare: (employers[0]?.n ?? 0) / r.n,
    }
  })
}

/** Private-sector jobs (BLS QCEW 2022 to 2025) and population (Census 2020 to 2025) for every county that reports both years. */
export async function loadCountyStats(): Promise<CountyStat[]> {
  const [{ context }, areas] = await Promise.all([
    loadCountyContext(),
    prisma.geoArea.findMany({ select: { id: true, state: true, name: true, population: true } }),
  ])
  const infoIdx = context.sectors.indexOf('51')
  if (infoIdx < 0 || !COUNTY_SECTORS.some((s) => s.code === '51')) throw new Error('county context has no Information sector')
  // A county slug is unique within its state: the name, or the name and FIPS when two share it.
  const names = new Map<string, number>()
  for (const a of areas) names.set(`${a.state}|${slugify(a.name)}`, (names.get(`${a.state}|${slugify(a.name)}`) ?? 0) + 1)
  const out: CountyStat[] = []
  for (const a of areas) {
    const c = context.counties[a.id]
    if (!c?.t || c.t[0] < 0 || c.t[1] < 0) continue
    const slug = (names.get(`${a.state}|${slugify(a.name)}`) ?? 0) > 1 ? `${slugify(a.name)}-${a.id}` : slugify(a.name)
    const then = c.e[2 * infoIdx]
    const now = c.e[2 * infoIdx + 1]
    out.push({
      fips: a.id, st: a.state, name: a.name, href: `/places/${stateSlugOf(a.state)}/county/${slug}`, population: a.population,
      populationChangePct: c.p && c.p[0] > 0 ? ((c.p[1] - c.p[0]) / c.p[0]) * 100 : null,
      jobsThen: c.t[0], jobsNow: c.t[1], infoThen: then >= 0 ? then : 0, infoNow: now >= 0 ? now : 0,
    })
  }
  return out
}

const LIVE = Prisma.sql`WHERE ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL}`
const MID_PAY = Prisma.sql`("salaryMin" + "salaryMax") / 2.0`

/** Openings and median posted pay by city for each of the given job families: one pass, cities and families with enough roles only. */
export async function loadFunctionCityRows(fns: string[]): Promise<{ st: string; city: string; fn: string; n: number; paid: number; payMed: number | null }[]> {
  const rows = await longRead((tx) => tx.$queryRaw<{ st: string; city: string; fn: string; n: number; paid: number; pay_med: number | null }[]>`
    SELECT "locationState" AS st, lower("locationCity") AS city, "targetFunction" AS fn, count(*)::int AS n,
      count(*) FILTER (WHERE ${PAID})::int AS paid,
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY ${MID_PAY}) FILTER (WHERE ${PAID}))::float AS pay_med
    FROM "ExclusiveJobPosting" ${WHERE} AND "targetFunction" = ANY(${fns})
    GROUP BY 1, 2, 3
    HAVING count(*) >= 15`)
  return rows.map((r) => ({ st: r.st, city: r.city, fn: r.fn, n: r.n, paid: r.paid, payMed: r.pay_med }))
}

type Col = 'aiSkillItems' | 'aiToolsNamed' | 'aiCertsNamed'
const KIND: Record<Col, 'skill' | 'tool' | 'cert'> = { aiSkillItems: 'skill', aiToolsNamed: 'tool', aiCertsNamed: 'cert' }

async function namedBy(col: Col): Promise<SkillStat[]> {
  const column = Prisma.raw(`"${col}"`)
  const rows = await longRead((tx) => tx.$queryRaw<{ fn: string | null; g: number; k: string; n: number; paid: number; pay: number | null }[]>`
    SELECT "targetFunction" AS fn, GROUPING("targetFunction")::int AS g, k, count(*)::int AS n,
      count(*) FILTER (WHERE ${PAID})::int AS paid,
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY ${MID_PAY}) FILTER (WHERE ${PAID}))::float AS pay
    FROM "ExclusiveJobPosting", unnest(${column}) AS k ${LIVE}
    GROUP BY GROUPING SETS (("targetFunction", k), (k))`)
  // Tool and certification names come in several spellings ("ChatGPT", "chatgpt"): count them together under the commonest.
  const merged = new Map<string, { fn: string; key: string; n: number; paid: number; payNum: number; names: Map<string, number> }>()
  for (const r of rows) {
    const fn = r.g === 1 ? '*' : r.fn
    if (!fn) continue
    const id = `${fn}|${KIND[col] === 'skill' ? r.k : r.k.toLowerCase().trim()}`
    const cur = merged.get(id) ?? { fn, key: r.k, n: 0, paid: 0, payNum: 0, names: new Map<string, number>() }
    cur.n += r.n
    cur.paid += r.paid
    cur.payNum += (r.pay ?? 0) * r.paid
    cur.names.set(r.k, (cur.names.get(r.k) ?? 0) + r.n)
    merged.set(id, cur)
  }
  return [...merged.values()].map((m) => ({
    fn: m.fn, kind: KIND[col], key: KIND[col] === 'skill' ? m.key : [...m.names].sort((a, b) => b[1] - a[1])[0][0],
    n: m.n, paid: m.paid, payMed: m.paid > 0 ? m.payNum / m.paid : null,
  }))
}

/** AI skills, tools and certifications named in postings, by job family and overall, with the openings in each family. */
export async function loadSkillStats(): Promise<{ stats: SkillStat[]; totals: FnTotal[] }> {
  const [skills, tools, certs, totalRows] = await Promise.all([
    namedBy('aiSkillItems'), namedBy('aiToolsNamed'), namedBy('aiCertsNamed'),
    longRead((tx) => tx.$queryRaw<{ fn: string | null; g: number; n: number; paid: number; pay: number | null }[]>`
      SELECT "targetFunction" AS fn, GROUPING("targetFunction")::int AS g, count(*)::int AS n, count(*) FILTER (WHERE ${PAID})::int AS paid,
        (percentile_cont(0.5) WITHIN GROUP (ORDER BY ${MID_PAY}) FILTER (WHERE ${PAID}))::float AS pay
      FROM "ExclusiveJobPosting" ${LIVE}
      GROUP BY GROUPING SETS (("targetFunction"), ())`),
  ])
  const totals: FnTotal[] = totalRows.flatMap((r) => (r.g === 1 ? [{ fn: '*', n: r.n, paid: r.paid, payMed: r.pay }] : r.fn ? [{ fn: r.fn, n: r.n, paid: r.paid, payMed: r.pay }] : []))
  return { stats: [...skills, ...tools, ...certs], totals }
}

/** Openings by industry bucket: the counts the industry lists rank on. A posting's industry text is read into the same buckets the industry pages use. */
export async function loadIndustryStats(): Promise<IndustryStat[]> {
  const rows = await longRead((tx) => tx.$queryRaw<{ ind: string; n: number; entry: number; ai: number; paid: number; pay: number | null }[]>`
    SELECT industry AS ind, count(*)::int AS n,
      count(*) FILTER (WHERE level IN ('ENTRY_IC', 'EARLY_IC'))::int AS entry,
      count(*) FILTER (WHERE cardinality("aiSkillGroups") > 0)::int AS ai,
      count(*) FILTER (WHERE ${PAID})::int AS paid,
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY ${MID_PAY}) FILTER (WHERE ${PAID}))::float AS pay
    FROM "ExclusiveJobPosting" ${LIVE} AND industry IS NOT NULL
    GROUP BY 1`)
  // Several raw spellings fall in one bucket: add the counts, and weight the medians by the openings that post pay.
  const merged = new Map<string, IndustryStat & { payNum: number }>()
  for (const r of rows) {
    const bucket = industryByName(bucketFromIndustryText(r.ind))
    if (!bucket) continue
    const cur = merged.get(bucket.name) ?? { name: bucket.name, n: 0, entry: 0, ai: 0, paid: 0, payMed: null, payNum: 0 }
    cur.n += r.n; cur.entry += r.entry; cur.ai += r.ai; cur.paid += r.paid; cur.payNum += (r.pay ?? 0) * r.paid
    merged.set(bucket.name, cur)
  }
  return [...merged.values()].map(({ payNum, ...m }) => ({ ...m, payMed: m.paid > 0 ? payNum / m.paid : null }))
}
