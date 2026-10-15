import 'server-only'
import { isGenericTitle, roleFromDescription, roleFromFunction } from './pivot-map'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { rolesForTitle } from './market-stats'
import { prisma } from '@/lib/prisma'
import { aggregateMarketRows, type MarketInputRow } from './market-stats'

const PAGE_SIZE = 5_000
const WRITE_CHUNK = 2_000
/** Archived jobs older than this can't fall in any trend window. */
const HISTORY_DAYS = 180

/**
 * Rebuilds PivotMarketStat from the board. Reads in id-ordered pages (narrow
 * columns only, from BoardLightRow), aggregates in memory, then swaps the
 * table's contents in one transaction so members never see a half-built set.
 */
export async function rebuildPivotMarketStats(now = new Date()): Promise<{ rowsRead: number; statsWritten: number; ms: number }> {
  const started = Date.now()
  const since = new Date(now.getTime() - HISTORY_DAYS * 86_400_000)
  const rows: MarketInputRow[] = []
  let cursor: string | undefined
  for (;;) {
    const page = await prisma.boardLightRow.findMany({
      where: {
        status: 'approved',
        institutionScopeId: null,
        distribution: { not: 'EXCLUDED' },
        OR: [
          { archivedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          { archivedAt: { gte: since } },
        ],
      },
      select: {
        id: true,
        title: true,
        companyName: true,
        location: true,
        level: true,
        sourceCategory: true,
        sourceCount: true,
        postedAt: true,
        createdAt: true,
        salaryMin: true,
        salaryMax: true,
        archivedAt: true,
      },
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    cursor = page[page.length - 1].id
  }

  // Generic titles ("Director", "Manager"): read the start of the description
  // to place them (about a quarter of the board).
  // Titles no role pattern matches: the board's function classifier first, then
  // (bare "Director"/"Manager") the description.
  for (const r of rows) if (rolesForTitle(r.title).length === 0) r.roleHint = roleFromFunction(inferFunctionFromTitle(r.title))
  const generic = rows.filter((r) => !r.roleHint && isGenericTitle(r.title) && rolesForTitle(r.title).length === 0)
  for (let i = 0; i < generic.length; i += 1000) {
    const ids = generic.slice(i, i + 1000).map((r) => r.id)
    const descs = await prisma.$queryRaw<{ id: string; d: string | null }[]>`select id, left(description, 2000) as d from public."ExclusiveJobPosting" where id = any(${ids})`
    const byId = new Map(descs.map((x) => [x.id, x.d]))
    for (const r of generic.slice(i, i + 1000)) r.roleHint = roleFromDescription(byId.get(r.id))
  }

  const stats = aggregateMarketRows(rows, now)
  const computedAt = new Date()
  await prisma.$transaction(
    async (tx) => {
      await tx.pivotMarketStat.deleteMany({})
      for (let i = 0; i < stats.length; i += WRITE_CHUNK) {
        await tx.pivotMarketStat.createMany({ data: stats.slice(i, i + WRITE_CHUNK).map((s) => ({ ...s, computedAt })) })
      }
    },
    { timeout: 120_000 }
  )
  return { rowsRead: rows.length, statsWritten: stats.length, ms: Date.now() - started }
}
