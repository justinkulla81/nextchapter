'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

/** Include a pitch in the morning email, or skip it. Only an offered/decided pitch can change. */
export async function decideRapSheet(sheetId: string, decision: 'APPROVED' | 'SKIPPED') {
  await requireAdmin()
  await prisma.crmRapSheet.updateMany({
    where: { id: sheetId, status: { in: ['OFFERED', 'APPROVED', 'SKIPPED'] } },
    data: { status: decision, decidedAt: new Date() },
  })
  revalidatePath('/support/admin/crm/rap-sheets')
}
