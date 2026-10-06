import 'server-only'
import { prisma } from '@/lib/prisma'

/** Conversations where the admin replied after the candidate last looked. */
export async function getHelpRepliesWaiting(candidateId: string): Promise<number> {
  const rows = await prisma.helpRequest.findMany({
    where: { candidateId, lastMessageFromAdmin: true },
    select: { lastMessageAt: true, candidateLastReadAt: true },
  })
  return rows.filter((r) => r.lastMessageAt > r.candidateLastReadAt).length
}
