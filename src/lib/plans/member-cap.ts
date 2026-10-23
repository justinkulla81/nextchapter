import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { capRoom, institutionEntitlements, planOf, type CapRoom } from './entitlements'

// How members are counted for the free plan's cap.
//
// "Held" members = every InstitutionMember row that has not opted out
// (IMPORTED, INVITED, CLAIMED, ACTIVE). Imported-only rows count: the free
// organization holds up to 50 people on its roster, whether or not they have
// joined yet, so an import cannot park 5,000 rows. OPTED_OUT rows are people
// who left; they do not count. (`includedSeats` is a different thing: the pool
// of seats an organization gives to its member companies. It is not a member
// count, so it plays no part here.)
//
// "Engaged" members = INVITED, CLAIMED and ACTIVE: people who have been
// invited or have joined. Invitations are limited by this count, so an
// organization that was switched from PAID to FREE with a large roster cannot
// invite more people than the cap, but nothing it already holds is removed.
export const HELD_STATUSES = ['IMPORTED', 'INVITED', 'CLAIMED', 'ACTIVE'] as const
export const ENGAGED_STATUSES = ['INVITED', 'CLAIMED', 'ACTIVE'] as const

export async function institutionPlanOf(institutionId: string): Promise<string> {
  const row = await prisma.institution.findUnique({ where: { id: institutionId }, select: { plan: true } })
  return planOf(row?.plan)
}

export async function heldMemberCount(institutionId: string): Promise<number> {
  return prisma.institutionMember.count({ where: { institutionId, status: { in: [...HELD_STATUSES] } } })
}

export async function engagedMemberCount(institutionId: string): Promise<number> {
  return prisma.institutionMember.count({ where: { institutionId, status: { in: [...ENGAGED_STATUSES] } } })
}

// Room for `adding` more held members. PAID is always allowed (and costs no query).
export async function heldMemberRoom(institutionId: string, plan: string, adding: number): Promise<CapRoom> {
  const cap = institutionEntitlements({ plan }).memberCap
  if (cap === null) return capRoom(null, 0, adding)
  return capRoom(cap, await heldMemberCount(institutionId), adding)
}

export function recordCapReached(distinctId: string, slug: string, cap: number, where: 'import' | 'invite') {
  captureServerEvent(distinctId, 'entitlement_cap_reached', { slug, cap, where })
}
