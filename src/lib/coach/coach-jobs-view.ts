import 'server-only'
import { prisma } from '@/lib/prisma'
import {
  computeHireabilityGrade,
  GRADE_RELATIONS_INCLUDE,
  type CandidateWithGradeRelations,
} from '@/lib/scoring/hireability-grade'
import { computeBoardListingFitBucket, computeSurfacedJobFitBucket } from '@/lib/jobs/job-fit-bucket'
import { isWeakFit, type FitBucket } from '@/lib/jobs/fit-bucket-types'
import type { ExclusiveJobPosting, SurfacedJob } from '@prisma/client'

export interface CoachJobsSnapshot {
  isAList: boolean
  openPostings: (ExclusiveJobPosting & { fitBucket: FitBucket })[]
  lockedCount: number
  surfacedJobs: (SurfacedJob & { fitBucket: FitBucket })[]
}

// The coach's read-only view of a consented client's Discover feed — same
// eligibility/fit logic the candidate themselves sees (see
// find-my-job/page.tsx), just computed against that specific candidateId
// and with no write actions. Confirmed nothing existing (getFullClientView,
// GRADE_RELATIONS_INCLUDE + computeHireabilityGrade) already exposes this
// combination, so this is new plumbing rather than a duplicate.
export async function getCoachJobsSnapshot(candidateId: string): Promise<CoachJobsSnapshot> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: GRADE_RELATIONS_INCLUDE,
  })

  const [grade, boardPostings, unreactedSurfacedJobs] = await Promise.all([
    computeHireabilityGrade(candidate as unknown as CandidateWithGradeRelations),
    prisma.exclusiveJobPosting.findMany({
      where: {
        status: 'approved',
        archivedAt: null,
        distribution: { not: 'EXCLUDED' },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.surfacedJob.findMany({
      where: { candidateId, reaction: null },
      orderBy: { surfacedAt: 'desc' },
      take: 5,
    }),
  ])

  const isAList = grade.grade === 'A'
  const eligible = boardPostings.filter((p) => p.audienceTier === 'ALL_CANDIDATES' || isAList)
  const lockedCount = boardPostings.filter((p) => p.audienceTier === 'A_LIST_ONLY' && !isAList).length

  const openPostings = eligible
    .map((p) => ({ ...p, fitBucket: computeBoardListingFitBucket(candidate, p) }))
    .filter((p) => p.distribution !== 'TARGETED' || !isWeakFit(p.fitBucket))

  const surfacedJobs = unreactedSurfacedJobs.map((job) => ({
    ...job,
    fitBucket: computeSurfacedJobFitBucket(candidate, job),
  }))

  return { isAList, openPostings, lockedCount, surfacedJobs }
}
