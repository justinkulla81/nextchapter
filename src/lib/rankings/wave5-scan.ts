import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PUBLIC_JOB_LIVE_SQL, PUBLIC_JOB_STATIC_SQL } from '@/lib/jobs/public-job-page-server'
import type { EntityStat, ProfileCityRow, SocGroupStat } from '@/lib/rankings/wave5-specs'

// The reads behind the wave 5 lists. Whole-board work, so they run only in the monthly build (the "profile" group), never on a
// page view. Each runs in its own transaction with a longer statement timeout than the default.

const PAID = Prisma.sql`"salaryMin" IS NOT NULL AND "salaryMax" >= "salaryMin" AND "payPeriod" = 'year' AND "salaryMin" >= 20000 AND "salaryMax" < 2000000 AND COALESCE("salaryCurrency", 'USD') = 'USD'`
const MID_PAY = Prisma.sql`("salaryMin" + "salaryMax") / 2.0`
const LIVE = Prisma.sql`WHERE ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL}`
const WITH_CITY = Prisma.sql`${LIVE} AND "locationState" IS NOT NULL AND "locationCity" IS NOT NULL`
const ENTRY = Prisma.sql`level IN ('ENTRY_IC', 'EARLY_IC')`
const AI = Prisma.sql`cardinality("aiSkillGroups") > 0`

async function longRead<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '600s'`)
    return run(tx)
  }, { timeout: 620_000, maxWait: 30_000 })
}

interface EntityRow { key: string; n: number; entry: number; entry_ai: number; ai: number; remote: number; hybrid: number; mgmt: number; eq: number; noexp: number; training: number; paid: number; pay_med: number | null }

async function entities(kind: 'function' | 'industry'): Promise<EntityStat[]> {
  const col = Prisma.raw(kind === 'function' ? '"targetFunction"' : 'industry')
  const rows = await longRead((tx) => tx.$queryRaw<EntityRow[]>`
    SELECT ${col} AS key, count(*)::int AS n,
      count(*) FILTER (WHERE ${ENTRY})::int AS entry,
      count(*) FILTER (WHERE ${ENTRY} AND ${AI})::int AS entry_ai,
      count(*) FILTER (WHERE ${AI})::int AS ai,
      count(*) FILTER (WHERE "workArrangement" = 'remote')::int AS remote,
      count(*) FILTER (WHERE "workArrangement" = 'hybrid')::int AS hybrid,
      count(*) FILTER (WHERE level IN ('MANAGER', 'SR_MANAGER', 'DIRECTOR', 'VP', 'HEAD', 'C_SUITE'))::int AS mgmt,
      count(*) FILTER (WHERE 'high_eq' = ANY("postingSignals"))::int AS eq,
      count(*) FILTER (WHERE 'no_experience_ok' = ANY("postingSignals"))::int AS noexp,
      count(*) FILTER (WHERE 'training_provided' = ANY("postingSignals"))::int AS training,
      count(*) FILTER (WHERE ${PAID})::int AS paid,
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY ${MID_PAY}) FILTER (WHERE ${PAID}))::float AS pay_med
    FROM "ExclusiveJobPosting" ${LIVE} AND ${col} IS NOT NULL
    GROUP BY 1`)
  return rows.map((r) => ({ kind, key: r.key, n: r.n, entry: r.entry, entryAi: r.entry_ai, ai: r.ai, remote: r.remote, hybrid: r.hybrid, mgmt: r.mgmt, eq: r.eq, noexp: r.noexp, training: r.training, paid: r.paid, payMed: r.pay_med }))
}

/** Counts by job family and by industry for the function and industry profile lists. */
export async function loadEntityStats(): Promise<EntityStat[]> {
  const [f, i] = await Promise.all([entities('function'), entities('industry')])
  return [...f, ...i]
}

/** The city counts behind the no-experience, entry-level-AI and hybrid city lists. */
export async function loadProfileCityRows(): Promise<ProfileCityRow[]> {
  const rows = await longRead((tx) => tx.$queryRaw<{ st: string; city: string; n: number; entry: number; entry_ai: number; noexp: number; hybrid: number }[]>`
    SELECT "locationState" AS st, lower("locationCity") AS city, count(*)::int AS n,
      count(*) FILTER (WHERE ${ENTRY})::int AS entry,
      count(*) FILTER (WHERE ${ENTRY} AND ${AI})::int AS entry_ai,
      count(*) FILTER (WHERE 'no_experience_ok' = ANY("postingSignals"))::int AS noexp,
      count(*) FILTER (WHERE "workArrangement" = 'hybrid')::int AS hybrid
    FROM "ExclusiveJobPosting" ${WITH_CITY}
    GROUP BY 1, 2
    HAVING count(*) >= 30`)
  return rows.map((r) => ({ st: r.st, city: r.city, n: r.n, entry: r.entry, entryAi: r.entry_ai, noexp: r.noexp, hybrid: r.hybrid }))
}

/** Openings and median posted pay by occupation group (the first two digits of the SOC code). */
export async function loadSocGroups(): Promise<SocGroupStat[]> {
  const rows = await longRead((tx) => tx.$queryRaw<{ soc: string; n: number; paid: number; pay_med: number | null }[]>`
    SELECT left("socCode", 2) AS soc, count(*)::int AS n, count(*) FILTER (WHERE ${PAID})::int AS paid,
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY ${MID_PAY}) FILTER (WHERE ${PAID}))::float AS pay_med
    FROM "ExclusiveJobPosting" ${LIVE} AND "socCode" IS NOT NULL
    GROUP BY 1`)
  return rows.map((r) => ({ soc: r.soc, n: r.n, paid: r.paid, payMed: r.pay_med }))
}
