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

// Counts and groupBys in SQL: the exclusive board table is ~97k rows, so
// never pull it into JS just to tally it.
export async function getJobsRollup(): Promise<JobsRollup> {
  const [
    trackedTotal,
    trackedApplied,
    trackedInterviewing,
    trackedOffered,
    surfacedTotal,
    surfacedUnreacted,
    surfacedInterested,
    surfacedNotInterested,
    reasonRows,
    boardRows,
    recentClicks,
    byCompany,
    byTitle,
  ] = await Promise.all([
    prisma.jobPosting.count(),
    prisma.jobPosting.count({ where: { appliedAt: { not: null } } }),
    prisma.jobPosting.count({ where: { interviewLandedAt: { not: null } } }),
    prisma.jobPosting.count({ where: { offerReceivedAt: { not: null } } }),
    prisma.surfacedJob.count(),
    prisma.surfacedJob.count({ where: { reaction: null } }),
    prisma.surfacedJob.count({ where: { reaction: 'INTERESTED' } }),
    prisma.surfacedJob.count({ where: { reaction: 'NOT_INTERESTED' } }),
    prisma.surfacedJob.groupBy({
      by: ['reactionReason'],
      where: { reactionReason: { not: null } },
      _count: { _all: true },
    }),
    prisma.exclusiveJobPosting.groupBy({
      by: ['source', 'status'],
      where: { archivedAt: null },
      _count: { _all: true },
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

  const sourceCounts = new Map<string, number>()
  let boardTotal = 0
  let boardPending = 0
  let boardApproved = 0
  for (const r of boardRows) {
    const n = r._count._all
    boardTotal += n
    if (r.status === 'pending') boardPending += n
    if (r.status === 'approved') boardApproved += n
    sourceCounts.set(r.source, (sourceCounts.get(r.source) ?? 0) + n)
  }

  return {
    tracked: {
      total: trackedTotal,
      applied: trackedApplied,
      interviewing: trackedInterviewing,
      offered: trackedOffered,
    },
    surfaced: {
      total: surfacedTotal,
      unreacted: surfacedUnreacted,
      interested: surfacedInterested,
      notInterested: surfacedNotInterested,
      reasonBreakdown: reasonRows
        .filter((r): r is typeof r & { reactionReason: string } => !!r.reactionReason)
        .map((r) => ({ reason: r.reactionReason, count: r._count._all }))
        .sort((a, b) => b.count - a.count),
    },
    board: {
      total: boardTotal,
      pending: boardPending,
      approved: boardApproved,
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
