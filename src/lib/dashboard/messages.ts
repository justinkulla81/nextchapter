import 'server-only'
import { prisma } from '@/lib/prisma'
import { startOfUTCDay } from '@/lib/daily/mood'

export interface DashboardMessageView {
  id: string
  title: string
  bullets: string[]
  footer: string | null
  isPinned: boolean
}

// The pinned message (How NextChapter works) always shows first, for every
// candidate, until they dismiss it — after that, whichever active,
// non-pinned message they haven't dismissed yet shows, oldest first so a
// rotation actually rotates instead of always landing on the newest.
// Dismissals only count for the rest of the day they were made — a message
// dismissed today reappears tomorrow rather than being gone for good.
export async function getNextDashboardMessage(candidateId: string): Promise<DashboardMessageView | null> {
  const dismissed = await prisma.candidateMessageDismissal.findMany({
    where: { candidateId, dismissedAt: { gte: startOfUTCDay() } },
    select: { messageId: true },
  })
  const dismissedIds = dismissed.map((d) => d.messageId)

  const pinned = await prisma.dashboardMessage.findFirst({
    where: { isPinned: true, isActive: true, id: { notIn: dismissedIds } },
  })
  if (pinned) return pinned

  const next = await prisma.dashboardMessage.findFirst({
    where: { isPinned: false, isActive: true, id: { notIn: dismissedIds } },
    orderBy: { createdAt: 'asc' },
  })
  return next
}
