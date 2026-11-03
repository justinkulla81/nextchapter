import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PUBLIC_JOB_LIVE_SQL, PUBLIC_JOB_STATIC_SQL } from '@/lib/jobs/public-job-page-server'
import { educationRows, type DegreeCityRow, type DegreeEntityStat, type GroupStat, type SocStat } from '@/lib/rankings/degrees-specs'

// The reads behind the degree lists. Whole-board work, so they run only in the monthly build (the "profile" group), never on a page
// view. Postings are joined to the BLS occupation table on the first seven characters of the SOC code.

const PAID = Prisma.sql`"salaryMin" IS NOT NULL AND "salaryMax" >= "salaryMin" AND "payPeriod" = 'year' AND "salaryMin" >= 20000 AND "salaryMax" < 2000000 AND COALESCE("salaryCurrency", 'USD') = 'USD'`
const MID_PAY = Prisma.sql`("salaryMin" + "salaryMax") / 2.0`
const LIVE = Prisma.sql`WHERE ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL} AND "socCode" IS NOT NULL`
const DEGREE4 = Prisma.sql`m.lvl IN ('bach', 'master', 'doctoral')`

async function longRead<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '600s'`)
    return run(tx)
  }, { timeout: 620_000, maxWait: 30_000 })
}

/** The BLS occupation table as a joinable list: SOC code, education level, field of study. */
function mapping() {
  const values = educationRows().map((r) => Prisma.sql`(${r.soc}::text, ${r.lvl}::text, ${r.fld}::text)`)
  return Prisma.sql`INNER JOIN (VALUES ${Prisma.join(values)}) AS m(soc, lvl, fld) ON m.soc = left("socCode", 7)`
}

/** Openings and posted pay by occupation. */
export async function loadSocStats(): Promise<SocStat[]> {
  const rows = await longRead((tx) => tx.$queryRaw<{ soc: string; n: number; paid: number; pay_med: number | null }[]>`
    SELECT left("socCode", 7) AS soc, count(*)::int AS n, count(*) FILTER (WHERE ${PAID})::int AS paid,
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY ${MID_PAY}) FILTER (WHERE ${PAID}))::float AS pay_med
    FROM "ExclusiveJobPosting" ${LIVE}
    GROUP BY 1`)
  return rows.map((r) => ({ soc: r.soc, n: r.n, paid: r.paid, payMed: r.pay_med }))
}

/** Openings and posted pay by education level and by field of study. */
export async function loadGroupStats(): Promise<GroupStat[]> {
  const rows = await longRead((tx) => tx.$queryRaw<{ gl: number; lvl: string | null; fld: string | null; n: number; paid: number; pay_med: number | null }[]>`
    SELECT GROUPING(m.lvl)::int AS gl, m.lvl, m.fld, count(*)::int AS n, count(*) FILTER (WHERE ${PAID})::int AS paid,
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY ${MID_PAY}) FILTER (WHERE ${PAID}))::float AS pay_med
    FROM "ExclusiveJobPosting" ${mapping()} ${LIVE}
    GROUP BY GROUPING SETS ((m.lvl), (m.fld))`)
  return rows.flatMap((r): GroupStat[] => {
    if (r.gl === 0 && r.lvl) return [{ kind: 'level', key: r.lvl, n: r.n, paid: r.paid, payMed: r.pay_med }]
    if (r.gl === 1 && r.fld) return [{ kind: 'field', key: r.fld, n: r.n, paid: r.paid, payMed: r.pay_med }]
    return []
  })
}

/** Jobs that need a four-year degree, by job family and by industry. */
export async function loadDegreeEntities(): Promise<DegreeEntityStat[]> {
  const rows = await longRead((tx) => tx.$queryRaw<{ gf: number; fn: string | null; ind: string | null; coded: number; d4: number }[]>`
    SELECT GROUPING("targetFunction")::int AS gf, "targetFunction" AS fn, industry AS ind, count(*)::int AS coded, count(*) FILTER (WHERE ${DEGREE4})::int AS d4
    FROM "ExclusiveJobPosting" ${mapping()} ${LIVE}
    GROUP BY GROUPING SETS (("targetFunction"), (industry))`)
  return rows.flatMap((r): DegreeEntityStat[] => {
    if (r.gf === 0 && r.fn) return [{ kind: 'function', key: r.fn, coded: r.coded, degree4: r.d4 }]
    if (r.gf === 1 && r.ind) return [{ kind: 'industry', key: r.ind, coded: r.coded, degree4: r.d4 }]
    return []
  })
}

/** Jobs that do not need a four-year degree, by city. */
export async function loadDegreeCityRows(): Promise<DegreeCityRow[]> {
  const rows = await longRead((tx) => tx.$queryRaw<{ st: string; city: string; coded: number; below: number }[]>`
    SELECT "locationState" AS st, lower("locationCity") AS city, count(*)::int AS coded, count(*) FILTER (WHERE NOT (${DEGREE4}))::int AS below
    FROM "ExclusiveJobPosting" ${mapping()} ${LIVE} AND "locationState" IS NOT NULL AND "locationCity" IS NOT NULL
    GROUP BY 1, 2
    HAVING count(*) >= 30`)
  return rows
}
