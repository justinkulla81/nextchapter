'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

export async function toggleCoachTestAccount(coachId: string, current: boolean): Promise<void> {
  await requireAdmin()

  await prisma.coach.update({
    where: { id: coachId },
    data: { isSampleData: !current },
  })

  revalidatePath('/support/admin/coaches')
  revalidatePath(`/support/admin/coaches/${coachId}`)
}
