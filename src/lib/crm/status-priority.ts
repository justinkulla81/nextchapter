import type { CrmDealStatus, CrmPriorityTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * A relationship status past the default means it's live, so those people
 * must not sit at P2 or unranked. Only ever raises, and stamps
 * priorityAutoAt so a priority set by hand afterwards stands (the same
 * convention as the email rule in priority-bump.ts).
 *
 *  - Follow up (a next step is scheduled) → at least P0
 *  - Keep in touch → at least P1
 *  - Organization deal: In conversation / Proposal / Pilot / Customer → P0,
 *    Contacted → P1 for the people there. Prospect, On hold and Lost don't lift.
 */
export const FOLLOW_UP_FLOOR: CrmPriorityTier = 'P0'
export const KEEP_IN_TOUCH_FLOOR: CrmPriorityTier = 'P1'

export function orgDealFloor(status: CrmDealStatus | null): CrmPriorityTier | null {
  if (status === 'IN_CONVERSATION' || status === 'PROPOSAL' || status === 'PILOT' || status === 'CUSTOMER') return 'P0'
  if (status === 'CONTACTED') return 'P1'
  return null
}

/** Raises each person to at least `tier`. Returns how many changed. */
export async function raisePriorityTo(personIds: string[], tier: CrmPriorityTier): Promise<number> {
  if (personIds.length === 0) return 0
  const lower: (CrmPriorityTier | null)[] = tier === 'P0' ? [null, 'P1', 'P2'] : tier === 'P1' ? [null, 'P2'] : []
  if (lower.length === 0) return 0
  const { count } = await prisma.crmPerson.updateMany({
    where: {
      id: { in: personIds }, deletedAt: null,
      OR: lower.map((priority) => ({ priority })),
    },
    data: { priority: tier, priorityAutoAt: new Date() },
  })
  return count
}
