import 'server-only'
import { prisma } from '@/lib/prisma'

/** Open bids on workforce boards' own procurement pages, soonest deadline first. Throws if the tables are not applied. */
export async function listOpenBoardBids(opts: { sinceHours?: number; limit?: number; now?: Date } = {}) {
  const now = opts.now ?? new Date()
  const bids = await prisma.boardBid.findMany({
    where: {
      status: 'OPEN',
      OR: [{ deadline: null }, { deadline: { gte: new Date(now.getTime() - 86_400_000) } }],
      ...(opts.sinceHours ? { firstSeenAt: { gte: new Date(now.getTime() - opts.sinceHours * 3_600_000) } } : {}),
    },
    orderBy: [{ firstSeenAt: 'desc' }],
    take: opts.limit ?? 300,
  })
  const boards = await prisma.workforceBoard.findMany({ where: { id: { in: [...new Set(bids.map((b) => b.boardId))] } }, select: { id: true, name: true, state: true } })
  const byId = new Map(boards.map((b) => [b.id, b]))
  return bids
    .map((b) => ({ ...b, boardName: byId.get(b.boardId)?.name ?? b.boardId, state: byId.get(b.boardId)?.state ?? '' }))
    .sort((a, b) => (a.deadline?.getTime() ?? Infinity) - (b.deadline?.getTime() ?? Infinity))
}

export async function listCompetitorAwards(opts: { sinceHours?: number; confidence?: 'EXACT' | 'REVIEW'; limit?: number } = {}) {
  return prisma.competitorAward.findMany({
    where: {
      ...(opts.confidence ? { confidence: opts.confidence } : {}),
      ...(opts.sinceHours ? { firstSeenAt: { gte: new Date(Date.now() - opts.sinceHours * 3_600_000) } } : {}),
    },
    orderBy: [{ startDate: 'desc' }],
    take: opts.limit ?? 2000,
  })
}
