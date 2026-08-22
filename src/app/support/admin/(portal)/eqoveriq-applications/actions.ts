'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

export async function approveEqOverIqApplication(id: string): Promise<void> {
  const admin = await requireAdmin()
  const actorEmail = admin.email ?? 'admin'

  await prisma.eqOverIqContributorProfile.update({
    where: { id },
    data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: actorEmail },
  })

  captureServerEvent(actorEmail, 'admin_eqoveriq_application_approved', { applicationId: id })
  revalidatePath('/support/admin/eqoveriq-applications')
  revalidatePath('/support/admin/eqoveriq-contributors')
  revalidatePath(`/support/admin/eqoveriq-contributors/${id}`)
}

export async function rejectEqOverIqApplication(id: string): Promise<void> {
  const admin = await requireAdmin()
  const actorEmail = admin.email ?? 'admin'

  await prisma.eqOverIqContributorProfile.update({
    where: { id },
    data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: actorEmail },
  })

  captureServerEvent(actorEmail, 'admin_eqoveriq_application_rejected', { applicationId: id })
  revalidatePath('/support/admin/eqoveriq-applications')
  revalidatePath('/support/admin/eqoveriq-contributors')
  revalidatePath(`/support/admin/eqoveriq-contributors/${id}`)
}
