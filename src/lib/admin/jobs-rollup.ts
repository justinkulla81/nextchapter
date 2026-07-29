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
  clicks: {
    recent: {
      id: string
      createdAt: Date
      candidateName: string
      jobTitle: string
      companyName: string | null
      source: string
      url: string
    }[]
    byCompany: { companyName: string; count: number }[]
    byTitle: { jobTitle: string; count: number }[]
  }
}

// One broad fetch per model + in-memory reduction, following the same
// pattern as src/lib/admin/metrics.ts rather than raw SQL/groupBy — keeps
// this consistent with the only other computed-aggregate admin view.
export async function getJobsRollup(): Promise<JobsRollup> {
  const [tracked, surfaced, board, recentClicks, byCompany, byTitle] = await Promise.all([
    prisma.jobPosting.findMany({
      select: { appliedAt: true, interviewLandedAt: true, offerReceivedAt: true },
    }),
    prisma.surfacedJob.findMany({
      select: { reaction: true, reactionReason: true },
    }),
    prisma.exclusiveJobPosting.findMany({
      select: { status: true, source: true, archivedAt: true },
    }),
    prisma.jobClickEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        jobTitle: true,
        companyName: true,
        source: true,
        url: true,
        candidate: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.jobClickEvent.groupBy({
      by: ['companyName'],
      where: { companyName: { not: null } },
      _count: true,
      orderBy: { _count: { companyName: 'desc' } },
      take: 25,
    }),
    prisma.jobClickEvent.groupBy({
      by: ['jobTitle'],
      _count: true,
      orderBy: { _count: { jobTitle: 'desc' } },
      take: 25,
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
    clicks: {
      recent: recentClicks.map((c) => ({
        id: c.id,
        createdAt: c.createdAt,
        candidateName: `${c.candidate.firstName} ${c.candidate.lastName}`,
        jobTitle: c.jobTitle,
        companyName: c.companyName,
        source: c.source,
        url: c.url,
      })),
      byCompany: byCompany
        .filter((c): c is typeof c & { companyName: string } => c.companyName !== null)
        .map((c) => ({ companyName: c.companyName, count: c._count })),
      byTitle: byTitle.map((t) => ({ jobTitle: t.jobTitle, count: t._count })),
    },
  }
}
