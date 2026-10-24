import 'server-only'
import { prisma } from '@/lib/prisma'
import type { HelpAudience } from '@/lib/help/constants'

/** Conversations where the admin replied after the requester last looked. */
export async function getHelpRepliesWaiting(requesterId: string, audience: HelpAudience = 'CANDIDATE'): Promise<number> {
  const rows = await prisma.helpRequest.findMany({
    where: { candidateId: requesterId, audience, lastMessageFromAdmin: true },
    select: { lastMessageAt: true, candidateLastReadAt: true },
  })
  return rows.filter((r) => r.lastMessageAt > r.candidateLastReadAt).length
}
