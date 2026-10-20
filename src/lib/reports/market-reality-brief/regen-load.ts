// Reads what the regenerate decision needs (current-report.ts) from the tables that already hold it.
// No schema change: the report rows are kept, so their timestamps are the rate-limit record.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { regenerationDecision, type RegenDecision } from './current-report'

export interface RegenState {
  lastGeneratedAt: Date | null
  decision: RegenDecision
}

export async function loadRegenState(candidateId: string, now = new Date()): Promise<RegenState> {
  const dayAgo = new Date(now.getTime() - 24 * 3_600_000)
  const [recent, profile, resume] = await Promise.all([
    prisma.marketRealityReport.findMany({
      where: { candidateId },
      orderBy: { generatedAt: 'desc' },
      take: 5,
      select: { generatedAt: true },
    }),
    prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { searchStrategyConfirmedAt: true } }),
    prisma.resume.findFirst({ where: { candidateId }, orderBy: { uploadedAt: 'desc' }, select: { uploadedAt: true } }),
  ])
  const lastGeneratedAt = recent[0]?.generatedAt ?? null
  const inDay = recent.filter((r) => r.generatedAt >= dayAgo)
  const [applicationsSince, referencesSince] = lastGeneratedAt
    ? await Promise.all([
        prisma.jobPosting.count({ where: { candidateId, appliedAt: { gt: lastGeneratedAt } } }),
        prisma.reference.count({ where: { candidateId, status: 'COMPLETED', completedAt: { gt: lastGeneratedAt } } }),
      ])
    : [0, 0]
  const decision = regenerationDecision({
    now,
    lastGeneratedAt,
    generatedLast24h: inDay.length,
    oldestOfLast24h: inDay.length > 0 ? inDay[inDay.length - 1].generatedAt : null,
    signals: {
      resumeUploadedAt: resume?.uploadedAt ?? null,
      searchStrategyConfirmedAt: profile?.searchStrategyConfirmedAt ?? null,
      applicationsSince,
      referencesSince,
    },
  })
  return { lastGeneratedAt, decision }
}
