import { prisma } from '@/lib/prisma'
import type { CommunityPost } from '@prisma/client'
import type { CommunityIdentitySource } from '@/lib/community/identity'

export interface CohortInfo {
  companyName: string
  layoffDate: Date
  posts: (CommunityPost & {
    candidate: CommunityIdentitySource
    reactions: { id: string }[]
    _count: { reactions: number }
  })[]
}

// No memberCount in the return shape — a raw cross-candidate count is
// exactly the aggregate-usage-statistic the Community rework's honesty-first
// requirement rules out, even scoped to one cohort. Posts alone tell the
// candidate this cohort is real and active.
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
    where: { isActive: true, moderationStatus: 'PUBLISHED', candidateId: { in: cohortCandidateIds } },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true, profilePictureUrl: true, confidentialSearchMode: true } },
      reactions: { where: { candidateId } },
      _count: { select: { reactions: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return {
    companyName: cohort.companyName,
    layoffDate: cohort.layoffDate,
    posts,
  }
}
