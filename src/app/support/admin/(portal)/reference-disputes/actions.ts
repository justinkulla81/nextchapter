'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'

export async function resolveReferenceDispute(referenceId: string) {
  await requireAdmin()

  await prisma.reference.update({
    where: { id: referenceId },
    data: { disputeResolvedAt: new Date() },
  })
  revalidatePath('/support/admin/reference-disputes')
}
