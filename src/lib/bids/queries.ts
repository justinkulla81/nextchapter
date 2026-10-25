import 'server-only'
import { prisma } from '@/lib/prisma'
import { listOpenOpportunities } from '@/lib/funding-opportunities/store'
import { crossRefs, type CrossRefs } from './crm-core'
import { bidFitsUs } from './relevance'

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

type Awards = Awaited<ReturnType<typeof listCompetitorAwards>>
type Bids = Awaited<ReturnType<typeof listOpenBoardBids>>

/** Cross-references between wins and open bids (board and federal), plus each competitor card's id for linking. */
export async function loadCrossRefs(awards: Awards, bids: Bids): Promise<{ refs: CrossRefs; cardIds: Record<string, string> }> {
  const opps = await listOpenOpportunities({ limit: 300 }).catch(() => [])
  const cards = await prisma.productCompetitor.findMany({ where: { name: { in: [...new Set(awards.map((a) => a.competitorName))] } }, select: { id: true, name: true } }).catch(() => [])
  const now = Date.now()
  // Wins still running or recent are the ones a similar bid could follow.
  const relevant = awards.filter((a) => a.confidence === 'EXACT' && (!a.endDate || a.endDate.getTime() > now - 365 * 86_400_000)).sort((x, y) => y.amount - x.amount).slice(0, 400)
  const refs = crossRefs(
    relevant.map((a) => ({ id: a.id, description: a.description, competitorName: a.competitorName, amount: a.amount, url: a.url })),
    bids.filter((b) => bidFitsUs(b.title)).map((b) => ({ id: b.id, title: b.title, boardName: b.boardName, state: b.state, url: b.url, deadline: b.deadline })),
    opps.map((o) => ({ id: o.id, title: o.title, agency: o.agency, url: o.url, closesAt: o.closesAt })),
  )
  return { refs, cardIds: Object.fromEntries(cards.map((c) => [c.name, c.id])) }
}
