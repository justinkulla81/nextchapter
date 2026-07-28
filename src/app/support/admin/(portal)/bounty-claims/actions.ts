'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'

export async function approveBountyClaim(claimId: string) {
  const admin = await requireAdmin()

  await prisma.bountyClaim.update({
    where: { id: claimId },
    data: { status: 'APPROVED', reviewedBy: admin?.email ?? null, reviewedAt: new Date(), rejectionReason: null },
  })
  revalidatePath('/support/admin/bounty-claims')
}

export async function rejectBountyClaim(claimId: string, reason: string) {
  const admin = await requireAdmin()

  await prisma.bountyClaim.update({
    where: { id: claimId },
    data: { status: 'REJECTED', reviewedBy: admin?.email ?? null, reviewedAt: new Date(), rejectionReason: reason || null },
  })
  revalidatePath('/support/admin/bounty-claims')
}

export async function markBountyClaimPaid(claimId: string) {
  await requireAdmin()

  await prisma.bountyClaim.update({
    where: { id: claimId },
    data: { paidAt: new Date() },
  })
  revalidatePath('/support/admin/bounty-claims')
}
