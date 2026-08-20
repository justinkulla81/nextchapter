'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { sendScholarshipDecisionEmail } from '@/lib/email/send-scholarship-decision'

// Every status transition here requires requireAdmin() and is invoked
// exclusively from an admin clicking Approve/Reject in the support portal —
// mirrors approveBountyClaim/rejectBountyClaim exactly. There is no other
// code path anywhere that writes ScholarshipApplication.status.
export async function approveScholarshipApplication(applicationId: string) {
  const admin = await requireAdmin()

  const application = await prisma.scholarshipApplication.update({
    where: { id: applicationId },
    data: { status: 'APPROVED', reviewedBy: admin?.email ?? null, reviewedAt: new Date(), decisionNote: null },
  })

  await sendScholarshipDecisionEmail({ candidateId: application.candidateId, approved: true })
  revalidatePath('/support/admin/scholarship-applications')
}

export async function rejectScholarshipApplication(applicationId: string, decisionNote: string) {
  const admin = await requireAdmin()

  const application = await prisma.scholarshipApplication.update({
    where: { id: applicationId },
    data: { status: 'REJECTED', reviewedBy: admin?.email ?? null, reviewedAt: new Date(), decisionNote: decisionNote || null },
  })

  await sendScholarshipDecisionEmail({ candidateId: application.candidateId, approved: false })
  revalidatePath('/support/admin/scholarship-applications')
}
