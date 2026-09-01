import 'server-only'
import { prisma } from '@/lib/prisma'

// Purely new posts since the candidate's last visit — not encouragement
// notes. Those are separately surfaced (with their own per-note "Dismiss")
// at the top of the Community page, and visiting the page already resets
// this count's own baseline (communityLastViewedAt); folding notes in here
// too meant the badge stayed stuck at a nonzero number after a visit,
// contradicting exactly what a "new since you were last here" badge should
// do — the candidate saw the note, but hadn't clicked its own Dismiss yet.
export async function getSupportNetworkUnreadCount(candidateId: string, lastViewedAt: Date): Promise<number> {
  return prisma.communityPost.count({
    // §14: only count posts this candidate could actually see — a HELD/
    // REMOVED post from someone else shouldn't inflate their unread badge.
    where: {
      isActive: true,
      moderationStatus: 'PUBLISHED',
      candidateId: { not: candidateId },
      createdAt: { gt: lastViewedAt },
    },
  })
}
