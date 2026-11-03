import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PUBLIC_JOB_LIVE_SQL, PUBLIC_JOB_STATIC_SQL } from '@/lib/jobs/public-job-page-server'
import { readBoardFigure } from '@/lib/jobs/stored-board-figures'
import type { JobAggregate } from '@/lib/places/places'
import { ALL_STATE_CODES } from '@/lib/seo/states'
import type { ConfEvent, FlexStat, StateFact } from '@/lib/rankings/wave6-specs'

// The reads behind the wave 6 lists. The one whole-board pass (fractional, interim and contract counts) runs only in the monthly
// build, never on a page view; the rest are small tables.

const LIVE = Prisma.sql`WHERE ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL}`

/** Per-state facts: catalog programs, job centers, the unemployed, our openings and the workers in the last year's layoff notices. */
export async function loadStateFacts(): Promise<StateFact[]> {
  const [programs, centers, labor, agg, notices] = await Promise.all([
    prisma.$queryRaw<{ state: string; category: string; n: number }[]>`
      SELECT "state", "category", count(*)::int AS n FROM "BenefitProgram"
      WHERE "state" IS NOT NULL AND "status" IN ('OPEN', 'ROLLING') AND ("locality" IS NULL OR "locality" !~ '^[A-Z]{2}$') AND "name" NOT LIKE '(none%'
      GROUP BY 1, 2`.catch(() => []),
    prisma.americanJobCenter.groupBy({ by: ['state'], _count: { _all: true } }),
    prisma.countyLabor.groupBy({ by: ['state'], _sum: { unemployed: true } }),
    readBoardFigure<JobAggregate>('places-job-aggregate'),
    prisma.warnNotice.groupBy({ by: ['state'], _sum: { employees: true }, where: { dismissedAt: null, state: { not: null }, noticeDate: { gte: new Date(Date.now() - 365 * 86_400_000) } } }),
  ])
  const by = <T,>(rows: T[], key: (r: T) => string | null) => new Map(rows.flatMap((r) => (key(r) ? [[key(r) as string, r] as const] : [])))
  const centersBy = by(centers, (r) => r.state)
  const laborBy = by(labor, (r) => r.state)
  const noticesBy = by(notices, (r) => r.state)
  const openingsBy = new Map((agg ?? []).map(([st, total]) => [st, total] as const))
  return ALL_STATE_CODES.map((st) => {
    const p = programs.filter((r) => r.state === st)
    const sum = (f: (r: { category: string; n: number }) => boolean) => p.filter(f).reduce((s, r) => s + r.n, 0)
    return {
      st, programs: sum(() => true), training: sum((r) => r.category === 'STATE_TRAINING'), relocation: sum((r) => r.category === 'RELOCATION'),
      ajc: centersBy.get(st)?._count._all ?? 0, unemployed: laborBy.get(st)?._sum.unemployed ?? 0, openings: openingsBy.get(st) ?? 0, noticed: noticesBy.get(st)?._sum.employees ?? 0,
    }
  })
}

/** American Job Centers by county FIPS. */
export async function loadAjcByCounty(): Promise<Map<string, number>> {
  const rows = await prisma.americanJobCenter.groupBy({ by: ['countyFips'], _count: { _all: true } })
  return new Map(rows.flatMap((r) => (r.countyFips ? [[r.countyFips, r._count._all] as const] : [])))
}

/** Published U.S. conferences from 30 days ago to twelve months ahead. */
export async function loadConferenceEvents(): Promise<ConfEvent[]> {
  const rows = await prisma.conferenceEvent.findMany({
    where: { published: true, country: 'US', city: { not: null }, state: { not: null }, startDate: { gte: new Date(Date.now() - 30 * 86_400_000), lte: new Date(Date.now() + 365 * 86_400_000) } },
    select: { city: true, state: true, startDate: true, importance: true, industries: true, functions: true },
  })
  return rows.flatMap((r) => (r.city && r.state && r.startDate ? [{ st: r.state, city: r.city, start: r.startDate.toISOString(), major: r.importance >= 3, industries: r.industries, functions: r.functions }] : []))
}

async function flex(kind: 'function' | 'industry'): Promise<FlexStat[]> {
  const col = Prisma.raw(kind === 'function' ? '"targetFunction"' : 'industry')
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '600s'`)
    return tx.$queryRaw<{ key: string; n: number; flex: number; contract: number }[]>`
      SELECT ${col} AS key, count(*)::int AS n,
        count(*) FILTER (WHERE "employmentType" IN ('fractional', 'interim'))::int AS flex,
        count(*) FILTER (WHERE "employmentType" = 'contract')::int AS contract
      FROM "ExclusiveJobPosting" ${LIVE} AND ${col} IS NOT NULL
      GROUP BY 1`
  }, { timeout: 620_000, maxWait: 30_000 })
  return rows.map((r) => ({ kind, key: r.key, n: r.n, flex: r.flex, contract: r.contract }))
}

/** Fractional, interim and contract counts by job family and by industry. */
export async function loadFlexStats(): Promise<FlexStat[]> {
  const [f, i] = await Promise.all([flex('function'), flex('industry')])
  return [...f, ...i]
}
