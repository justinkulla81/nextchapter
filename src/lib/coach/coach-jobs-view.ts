import 'server-only'
import { prisma } from '@/lib/prisma'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { computeBoardListingFitBucket, computeSurfacedJobFitBucket } from '@/lib/jobs/job-fit-bucket'
import { isWeakFit, type FitBucket } from '@/lib/jobs/fit-bucket-types'
import { loadBoardShortlist } from '@/lib/jobs/board-shortlist'
import type { ExclusiveJobPosting, SurfacedJob } from '@prisma/client'

export interface CoachJobsSnapshot {
  isCandidatePlus: boolean
  openPostings: (ExclusiveJobPosting & { fitBucket: FitBucket })[]
  lockedCount: number
  surfacedJobs: (SurfacedJob & { fitBucket: FitBucket })[]
}

// The coach's read-only view of a consented client's Discover feed — same
// eligibility/fit logic the candidate themselves sees (see
// find-my-job/page.tsx), just computed against that specific candidateId
// and with no write actions.
export async function getCoachJobsSnapshot(candidateId: string): Promise<CoachJobsSnapshot> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
  })

  const [dossierStatus, unreactedSurfacedJobs] = await Promise.all([
    isDossierUnlocked(candidateId),
    prisma.surfacedJob.findMany({
      where: { candidateId, reaction: null },
      orderBy: { surfacedAt: 'desc' },
      take: 5,
    }),
  ])

  const isCandidatePlus = dossierStatus.unlocked
  // Best-fitting jobs only — the board is tens of thousands of rows (see board-shortlist.ts).
  const board = await loadBoardShortlist({ candidate, isCandidatePlus })
  const eligible = board.open
  const lockedCount = board.lockedTotal

  const openPostings = eligible
    .map((p) => ({ ...p, fitBucket: computeBoardListingFitBucket(candidate, p) }))
    .filter((p) => p.distribution !== 'TARGETED' || !isWeakFit(p.fitBucket))

  const surfacedJobs = unreactedSurfacedJobs.map((job) => ({
    ...job,
    fitBucket: computeSurfacedJobFitBucket(candidate, job),
  }))

  return { isCandidatePlus, openPostings, lockedCount, surfacedJobs }
}
