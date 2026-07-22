import 'server-only'
import { prisma } from '@/lib/prisma'

export async function getSupportNetworkUnreadCount(
  candidateId: string,
  lastViewedAt: Date
): Promise<number> {
  const [newPosts, unreadNotes] = await Promise.all([
    prisma.communityPost.count({
      where: { isActive: true, candidateId: { not: candidateId }, createdAt: { gt: lastViewedAt } },
    }),
    prisma.encouragementNote.count({
      where: { toCandidateId: candidateId, readAt: null },
    }),
  ])
  return newPosts + unreadNotes
}
