import 'server-only'
import { prisma } from '@/lib/prisma'

export interface RoleFeedState {
  /** Role slugs the member has left: the feed is not offered for them and the digest is not sent. */
  left: Set<string>
  /** Role slugs where the member turned the officer-change news off. */
  muted: Set<string>
}

/** What a member has done with their role networks, from their ROLE memberships. */
export async function roleFeedState(candidateId: string): Promise<RoleFeedState> {
  const rows = await prisma.communityMembership.findMany({
    where: { candidateId, community: { type: 'ROLE' } },
    select: { leftAt: true, turnoverMutedAt: true, community: { select: { value: true } } },
  })
  return {
    left: new Set(rows.filter((r) => r.leftAt).map((r) => r.community.value)),
    muted: new Set(rows.filter((r) => !r.leftAt && r.turnoverMutedAt).map((r) => r.community.value)),
  }
}
