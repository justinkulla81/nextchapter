'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { captureServerEvent } from '@/lib/posthog/server'
import { INTERNAL_ROLE_STATUS, candidateOrgIds } from '@/lib/employer/staff-programs'

// Raising a hand shares this person's name and email with their employer for
// this one role (the button says so); taking it back removes it.
export async function setInternalRoleInterest(postingId: string, interested: boolean, note?: string): Promise<{ error?: string }> {
  const profile = await getDashboardProfile()
  const orgIds = await candidateOrgIds(profile.id, 'GROWTH')
  const role = await prisma.exclusiveJobPosting.findFirst({ where: { id: postingId, status: INTERNAL_ROLE_STATUS, orgScopeId: { in: orgIds } }, select: { id: true, orgScopeId: true, archivedAt: true } })
  if (!role) return { error: 'This role is no longer listed.' }
  if (interested) {
    if (role.archivedAt) return { error: 'This role has closed.' }
    const clean = note?.trim().slice(0, 1000) || null
    await prisma.internalRoleInterest.upsert({
      where: { postingId_candidateId: { postingId, candidateId: profile.id } },
      create: { postingId, candidateId: profile.id, note: clean },
      update: { note: clean },
    })
  } else {
    await prisma.internalRoleInterest.deleteMany({ where: { postingId, candidateId: profile.id } })
  }
  captureServerEvent(profile.id, interested ? 'internal_role_interest_shared' : 'internal_role_interest_withdrawn', { postingId, orgId: role.orgScopeId, withNote: !!note?.trim() })
  revalidatePath('/dashboard/internal-roles')
  return {}
}
