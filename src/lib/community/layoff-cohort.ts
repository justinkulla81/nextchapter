import { prisma } from '@/lib/prisma'
import type { CommunityPost } from '@prisma/client'

export interface CohortInfo {
  companyName: string
  layoffDate: Date
  memberCount: number
  posts: (CommunityPost & { candidate: { firstName: string | null; lastName: string | null } })[]
}

export async function getCohortInfo(layoffCohortId: string, candidateId: string): Promise<CohortInfo | null> {
  const cohort = await prisma.layoffCohort.findUnique({
    where: { id: layoffCohortId },
    select: {
      companyName: true,
      layoffDate: true,
      candidates: { select: { id: true } },
    },
  })
  if (!cohort) return null

  const cohortCandidateIds = cohort.candidates.map((c) => c.id).filter((id) => id !== candidateId)

  const posts = await prisma.communityPost.findMany({
    where: { isActive: true, candidateId: { in: cohortCandidateIds } },
    include: { candidate: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return {
    companyName: cohort.companyName,
    layoffDate: cohort.layoffDate,
    memberCount: cohortCandidateIds.length,
    posts,
  }
}
