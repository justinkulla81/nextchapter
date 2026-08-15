import 'server-only'
import { prisma } from '@/lib/prisma'
import type { SeniorityBand } from '@/lib/scoring/resume-analysis/types'
import { SENIORITY_BANDS, SENIORITY_BAND_LABEL } from '@/lib/leaderboard/boards'

// Re-exported for server-side callers already importing from this module —
// boards.ts (client-safe, no server-only) is the actual source of truth for
// both constants now, see its own comment.
export { SENIORITY_BANDS, SENIORITY_BAND_LABEL }

// §15 "Segment by seniority band, matching Community." Same query pattern
// as getSeniorityBand in dossier-unlock.ts and getCandidateGroups in
// community/groups.ts — the candidate's most recent ResumeAnalysis.seniorityBand
// — deliberately re-derived here rather than importing either of those
// (both are private helpers not meant for cross-module reuse; this is the
// third real call site of the same one-line query, not worth a shared
// helper module of its own).
export async function getSeniorityBand(candidateId: string): Promise<SeniorityBand | null> {
  const analysis = await prisma.resumeAnalysis.findFirst({
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
    select: { seniorityBand: true },
  })
  return (analysis?.seniorityBand as SeniorityBand | undefined) ?? null
}

// Bulk version for ranking a whole board — one query for every candidate's
// latest seniority band instead of N. groupBy + a per-candidate max date
// isn't expressible cleanly in Prisma for a "most recent row per group"
// read, so this takes the simple, correct route: pull every ResumeAnalysis
// row for the candidate pool (ordered so the first one seen per candidate is
// the latest) and keep only the first hit per candidateId. Candidate pools
// for a single board are at most a few thousand rows in practice, so this is
// cheap; revisit with a raw SQL DISTINCT ON if that stops being true.
export async function getSeniorityBandsForCandidates(candidateIds: string[]): Promise<Map<string, SeniorityBand | null>> {
  const result = new Map<string, SeniorityBand | null>()
  if (candidateIds.length === 0) return result

  const rows = await prisma.resumeAnalysis.findMany({
    where: { candidateId: { in: candidateIds } },
    orderBy: { createdAt: 'desc' },
    select: { candidateId: true, seniorityBand: true },
  })
  for (const row of rows) {
    if (!result.has(row.candidateId)) {
      result.set(row.candidateId, (row.seniorityBand as SeniorityBand | undefined) ?? null)
    }
  }
  for (const id of candidateIds) {
    if (!result.has(id)) result.set(id, null)
  }
  return result
}
