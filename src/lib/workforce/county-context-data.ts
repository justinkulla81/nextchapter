import 'server-only'
import { prisma } from '@/lib/prisma'
import { ttlCached } from '@/lib/admin/ttl-cache'
import { placeKeys } from './places'
import { jobsByCounty, type CountyContextData } from './county-context'

let bundled: Promise<{ context: CountyContextData; placeCounty: Record<string, string> }> | null = null
/** The bundled Census and QCEW data, read on first use so other routes do not carry it. */
export function loadCountyContext() {
  bundled ??= Promise.all([import('./data/county-context.json'), import('./data/place-county.json')]).then(([c, p]) => ({
    context: c.default as unknown as CountyContextData,
    placeCounty: p.default as Record<string, string>,
  }))
  return bundled
}

/** Whole-market job openings by state (BLS JOLTS, 12-month average), bundled; empty when the file is missing. */
export const loadStateOpenings = () =>
  import('./data/state-openings.json').then((m) => m.default as Record<string, number>).catch(() => ({}) as Record<string, number>)

/**
 * Open roles on the job board by county FIPS: postings are grouped by the
 * city they name and each city goes to its county. Postings with no city
 * (remote, statewide) are not in any county.
 */
export const openJobsByCounty = ttlCached(10 * 60 * 1000, async () => {
  const [groups, { placeCounty }] = await Promise.all([
    prisma.$queryRaw<{ st: string; city: string; n: bigint }[]>`
      select "locationState" st, "locationCity" city, count(*) n from "ExclusiveJobPosting"
       where status = 'approved' and "archivedAt" is null and "locationState" is not null and "locationCity" is not null
       group by 1, 2`,
    loadCountyContext(),
  ])
  return jobsByCounty(groups.map((g) => ({ ...g, n: Number(g.n) })), placeCounty, placeKeys)
})

/** Unemployment for every state and the nation, from the same county rows the boards use. */
export const laborBenchmarks = ttlCached(10 * 60 * 1000, async () => {
  const rows = await prisma.countyLabor.groupBy({
    by: ['state'],
    where: { laborForce: { gt: 0 }, unemployed: { not: null }, period: { notIn: ['none'] } },
    _sum: { laborForce: true, unemployed: true },
  })
  const rate = (u: number, l: number) => (l > 0 ? Math.round((u / l) * 1000) / 10 : null)
  const byState = new Map<string, number>()
  const unemployedByState = new Map<string, number>()
  let u = 0, l = 0
  for (const r of rows) {
    const [su, sl] = [r._sum.unemployed ?? 0, r._sum.laborForce ?? 0]
    const x = rate(su, sl)
    if (x != null) byState.set(r.state, x)
    unemployedByState.set(r.state, su)
    u += su; l += sl
  }
  return { byState, unemployedByState, national: rate(u, l) }
})

/** Degree-granting colleges by state and county, with how many are public 2-year (community colleges). */
export const collegesByCounty = ttlCached(10 * 60 * 1000, async () => {
  const rows = await prisma.localCollege.groupBy({ by: ['state', 'countyFips', 'sector'], _count: { _all: true } })
  return rows
})
