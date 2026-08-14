import 'server-only'
import { prisma } from '@/lib/prisma'

export async function getSupportNetworkUnreadCount(
  candidateId: string,
  lastViewedAt: Date
): Promise<number> {
  const [newPosts, unreadNotes] = await Promise.all([
    prisma.communityPost.count({
      // §14: only count posts this candidate could actually see — a HELD/
      // REMOVED post from someone else shouldn't inflate their unread badge.
      where: {
        isActive: true,
        moderationStatus: 'PUBLISHED',
        candidateId: { not: candidateId },
        createdAt: { gt: lastViewedAt },
      },
    }),
    prisma.encouragementNote.count({
      where: { toCandidateId: candidateId, readAt: null },
    }),
  ])
  return newPosts + unreadNotes
}
