import 'server-only'
import { prisma } from '@/lib/prisma'

export interface CoachMatchSummary {
  coachId: string
  fullName: string
  clientCount: number
}

// Manual rebalancing tool, not automated fairness enforcement — deliberate,
// per the matching design's Phase 1 scope: at this scale a human watching
// the whole roster is an honest substitute for machinery not worth building yet.
export async function getCoachMatchDistribution(): Promise<CoachMatchSummary[]> {
  const coaches = await prisma.coach.findMany({
    where: { isSampleData: false },
    select: { id: true, fullName: true, _count: { select: { clients: true } } },
    orderBy: { fullName: 'asc' },
  })
  return coaches
    .map((c) => ({ coachId: c.id, fullName: c.fullName, clientCount: c._count.clients }))
    .sort((a, b) => b.clientCount - a.clientCount)
}
