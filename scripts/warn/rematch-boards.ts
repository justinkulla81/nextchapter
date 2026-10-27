/**
 * Re-runs the workforce-board match for recent notices that have none (a board is looked up once, so a notice checked before the
 * address reader or a board's counties improved stays unmatched until reset).
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/warn/rematch-boards.ts
 */
import { PrismaClient } from '@prisma/client'
import { matchNoticesToBoards } from '../../src/lib/workforce/match'

const prisma = new PrismaClient()
async function main() {
  const since = new Date(Date.now() - 540 * 86_400_000)
  const reset = await prisma.warnNotice.updateMany({
    where: { dismissedAt: null, workforceBoardId: null, state: { not: null }, noticeDate: { gte: since }, NOT: { sourceUrl: { contains: 'layoffs.fyi' } } },
    data: { boardCheckedAt: null },
  })
  console.log('reset', reset.count)
  for (let i = 0; i < 30; i++) {
    const r = await matchNoticesToBoards(100_000)
    console.log('pass', i, r)
    if (r.checked === 0) break
  }
  const since12 = new Date(Date.now() - 365 * 86_400_000)
  const left = await prisma.warnNotice.groupBy({ by: ['state'], where: { dismissedAt: null, workforceBoardId: null, state: { not: null }, source: 'WARN_FILING', noticeDate: { gte: since12 }, NOT: { sourceUrl: { contains: 'layoffs.fyi' } } }, _count: true })
  console.log('still without a board', left.sort((a, b) => b._count - a._count))
}
main().finally(() => prisma.$disconnect())
