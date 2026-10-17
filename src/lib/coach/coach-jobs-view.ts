import 'server-only'
import { prisma } from '@/lib/prisma'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { computeBoardListingFitBucket, computeSurfacedJobFitBucket } from '@/lib/jobs/job-fit-bucket'
import { isWeakFit, type FitBucket } from '@/lib/jobs/fit-bucket-types'
import { loadBoardShortlist } from '@/lib/jobs/board-shortlist'
import type { ExclusiveJobPosting, SurfacedJob } from '@prisma/client'
import { boardBreadthFor } from '@/lib/jobs/search-breadth'
import { boardJobCardTexts, surfacedJobCardText } from '@/lib/jobs/job-card-server'
import type { JobCardText } from '@/lib/jobs/job-card'

export interface CoachJobsSnapshot {
  isCandidatePlus: boolean
  /** Each job with the board card's verdict, why line and meta line (job-card-server.ts). */
  openPostings: (ExclusiveJobPosting & { fitBucket: FitBucket; card: JobCardText })[]
  surfacedJobs: (SurfacedJob & { fitBucket: FitBucket; card: JobCardText })[]
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
  const board = await loadBoardShortlist({ candidate, isCandidatePlus, includeMidLevel: true, includeEarlyCareer: true, breadth: boardBreadthFor(candidate) })
  const eligible = board.open

  const shown = eligible
    .map((p) => ({ ...p, fitBucket: computeBoardListingFitBucket(candidate, p) }))
    .filter((p) => p.distribution !== 'TARGETED' || !isWeakFit(p.fitBucket))
  // The same verdict, why line and meta line the client sees on their own board.
  const cards = boardJobCardTexts({ candidate, shortlist: board, postings: shown, fitBucketFor: (p) => (p as (typeof shown)[number]).fitBucket })
  const openPostings = shown.map((p) => ({ ...p, card: cards.get(p.id)! }))

  const surfacedJobs = unreactedSurfacedJobs.map((job) => {
    const fitBucket = computeSurfacedJobFitBucket(candidate, job)
    return { ...job, fitBucket, card: surfacedJobCardText(job, fitBucket) }
  })

  return { isCandidatePlus, openPostings, surfacedJobs }
}
