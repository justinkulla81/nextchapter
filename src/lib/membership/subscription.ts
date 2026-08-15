import 'server-only'
import type { MembershipSubscription } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Single read helper every membership-gated surface should use (interim-work
// Board & Advisory section, coach matching's priority boost, the Membership
// dashboard page) so "is this candidate a member right now" has one
// definition: an ACTIVE MembershipSubscription row. LAPSED/CANCELLED both
// read as "not a member" -- break-glass reactivation is the only path back
// to ACTIVE.
export async function getMembershipSubscription(candidateId: string): Promise<MembershipSubscription | null> {
  return prisma.membershipSubscription.findUnique({ where: { candidateId } })
}

export async function isActiveMember(candidateId: string): Promise<boolean> {
  const sub = await getMembershipSubscription(candidateId)
  return sub?.status === 'ACTIVE'
}
