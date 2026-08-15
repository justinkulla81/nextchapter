'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { activateAlumStatus } from '@/lib/membership/activate-alum'

export async function approveBountyClaim(claimId: string) {
  const admin = await requireAdmin()

  const claim = await prisma.bountyClaim.update({
    where: { id: claimId },
    data: { status: 'APPROVED', reviewedBy: admin?.email ?? null, reviewedAt: new Date(), rejectionReason: null },
  })

  // Phase 8, §A2.4 — an admin-approved bounty claim (offer letter +
  // testimonial, admin-reviewed) is the most reliable human-verified "this
  // candidate really got hired" signal in the codebase. Grants `alum` for
  // real and, if this placement came through a Premium outplacement seat,
  // starts a free 12-month Membership.
  await activateAlumStatus(claim.candidateId, 'bounty_claim_approved')

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
