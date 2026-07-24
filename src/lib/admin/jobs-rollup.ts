import 'server-only'
import { prisma } from '@/lib/prisma'

export interface JobsRollup {
  tracked: {
    total: number
    applied: number
    interviewing: number
    offered: number
  }
  surfaced: {
    total: number
    unreacted: number
    interested: number
    notInterested: number
    reasonBreakdown: { reason: string; count: number }[]
  }
  board: {
    total: number
    pending: number
    approved: number
    bySource: { source: string; count: number }[]
  }
}

// One broad fetch per model + in-memory reduction, following the same
// pattern as src/lib/admin/metrics.ts rather than raw SQL/groupBy — keeps
// this consistent with the only other computed-aggregate admin view.
export async function getJobsRollup(): Promise<JobsRollup> {
  const [tracked, surfaced, board] = await Promise.all([
    prisma.jobPosting.findMany({
      select: { appliedAt: true, interviewLandedAt: true, offerReceivedAt: true },
    }),
    prisma.surfacedJob.findMany({
      select: { reaction: true, reactionReason: true },
    }),
    prisma.exclusiveJobPosting.findMany({
      select: { status: true, source: true, archivedAt: true },
    }),
  ])

  const reasonCounts = new Map<string, number>()
  for (const j of surfaced) {
    if (j.reactionReason) reasonCounts.set(j.reactionReason, (reasonCounts.get(j.reactionReason) ?? 0) + 1)
  }

  const sourceCounts = new Map<string, number>()
  for (const p of board) {
    if (p.archivedAt) continue
    sourceCounts.set(p.source, (sourceCounts.get(p.source) ?? 0) + 1)
  }

  return {
    tracked: {
      total: tracked.length,
      applied: tracked.filter((j) => j.appliedAt !== null).length,
      interviewing: tracked.filter((j) => j.interviewLandedAt !== null).length,
      offered: tracked.filter((j) => j.offerReceivedAt !== null).length,
    },
    surfaced: {
      total: surfaced.length,
      unreacted: surfaced.filter((j) => j.reaction === null).length,
      interested: surfaced.filter((j) => j.reaction === 'INTERESTED').length,
      notInterested: surfaced.filter((j) => j.reaction === 'NOT_INTERESTED').length,
      reasonBreakdown: Array.from(reasonCounts.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    },
    board: {
      total: board.filter((p) => !p.archivedAt).length,
      pending: board.filter((p) => p.status === 'pending' && !p.archivedAt).length,
      approved: board.filter((p) => p.status === 'approved' && !p.archivedAt).length,
      bySource: Array.from(sourceCounts.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
    },
  }
}
