'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

// Record-keeping only — matches the existing RecruiterFirm.status
// precedent, which is bookkeeping, not an access gate, everywhere else in
// this codebase today. Suspending an employer here does NOT block their
// login. Real enforcement would be a separate, deliberate change to
// getCrucibleEmployerDashboardData() plus the auth middleware.
export async function suspendEmployer(employerId: string, currentlySuspended: boolean): Promise<void> {
  const admin = await requireAdmin()
  const actorEmail = admin.email ?? 'admin'

  await prisma.crucibleEmployerProfile.update({
    where: { id: employerId },
    data: currentlySuspended
      ? { suspendedAt: null, suspendedBy: null }
      : { suspendedAt: new Date(), suspendedBy: actorEmail },
  })

  captureServerEvent(actorEmail, 'admin_nen_employer_suspended', { employerId, suspended: !currentlySuspended })
  revalidatePath('/support/admin/nen-employers')
  revalidatePath(`/support/admin/nen-employers/${employerId}`)
}
