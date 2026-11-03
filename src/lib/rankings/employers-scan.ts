import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PUBLIC_JOB_LIVE_SQL, PUBLIC_JOB_STATIC_SQL } from '@/lib/jobs/public-job-page-server'
import { FAMILIES } from '@/lib/rankings/build-edition'
import { employerLinks } from '@/lib/rankings/employer-links'
import { combineEmployers, parentOf, type EmployerGrowth, type EmployerStat } from '@/lib/rankings/employers-specs'

// The reads behind the employer hiring lists. Whole-board work, so they run only in the monthly build (the "support" group), never
// on a page view. The same public, verified postings the other lists use, without hourly roles or search-firm postings.

const LIVE = Prisma.sql`WHERE ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL}
  AND COALESCE("payPeriod", '') <> 'hour' AND COALESCE("postingType", 'direct') <> 'recruiter_search' AND COALESCE("sourceCategory", '') <> 'search_firm'`

async function longRead<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '600s'`)
    return run(tx)
  }, { timeout: 620_000, maxWait: 30_000 })
}

/** Open roles by employer name, with the count at each level and in each job family. Names are combined by parent brand in the caller. */
export async function loadEmployerStats(): Promise<EmployerStat[]> {
  const fnCols = FAMILIES.map((f, i) => Prisma.sql`count(*) FILTER (WHERE "targetFunction" = ${f.fn})::int AS ${Prisma.raw(`f${i}`)}`)
  const rows = await longRead((tx) => tx.$queryRaw<Record<string, number | string | null>[]>`
    SELECT "companyName" AS name, count(*)::int AS n,
      count(*) FILTER (WHERE level IN ('ENTRY_IC', 'EARLY_IC'))::int AS junior,
      count(*) FILTER (WHERE level = 'MID_IC')::int AS mid,
      count(*) FILTER (WHERE level IN ('SENIOR_IC', 'PRINCIPAL'))::int AS senior,
      count(*) FILTER (WHERE level IN ('MANAGER', 'SR_MANAGER', 'DIRECTOR', 'HEAD', 'VP', 'EVP_SVP', 'C_SUITE'))::int AS lead,
      ${Prisma.join(fnCols)},
      (array_agg("companyId") FILTER (WHERE "companyId" IS NOT NULL))[1] AS company_id
    FROM "ExclusiveJobPosting" ${LIVE}
    GROUP BY 1
    HAVING count(*) >= 5`)
  const sizes = await companySizes(rows.map((r) => r.company_id as string | null).filter((x): x is string => !!x))
  const stats: EmployerStat[] = rows.map((r) => ({
    name: String(r.name), n: Number(r.n), junior: Number(r.junior), mid: Number(r.mid), senior: Number(r.senior), lead: Number(r.lead),
    fn: Object.fromEntries(FAMILIES.map((f, i) => [f.fn, Number(r[`f${i}`] ?? 0)] as const).filter(([, c]) => c > 0)),
    sizeBand: r.company_id ? sizes.get(String(r.company_id)) ?? null : null,
  }))
  return combineEmployers(stats)
}

async function companySizes(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 5000) {
    const rows = await prisma.company.findMany({ where: { id: { in: ids.slice(i, i + 5000) }, sizeBand: { not: null } }, select: { id: true, sizeBand: true } })
    for (const r of rows) if (r.sizeBand) out.set(r.id, r.sizeBand)
  }
  return out
}

/** Each company's open roles in the latest weekly signal and the change over twelve weeks. */
export async function loadEmployerGrowth(): Promise<EmployerGrowth[]> {
  const rows = await prisma.$queryRaw<{ name: string; open: number; delta12: number; size_band: string | null }[]>`
    SELECT c.name, s."openRolesTotal"::int AS open, s."rolesDelta12wk"::int AS delta12, c."sizeBand" AS size_band
    FROM "CompanySignal" s JOIN "Company" c ON c.id = s."companyId"
    WHERE s."weekStartDate" = (SELECT max("weekStartDate") FROM "CompanySignal")
      AND s."rolesDelta12wk" IS NOT NULL AND s."openRolesTotal" >= 40`
  return rows.map((r) => ({ name: r.name, open: r.open, delta12: r.delta12, sizeBand: r.size_band }))
}

/** The employer page for each name that has one, by the name the lists show. */
export async function employerHrefs(names: string[]): Promise<(name: string) => string | null> {
  const links = await employerLinks([...new Set(names)])
  return (name) => links.get(name) ?? null
}

export { parentOf }
