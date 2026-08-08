'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

export async function toggleRecruiterTestAccount(recruiterId: string, current: boolean): Promise<void> {
  await requireAdmin()

  await prisma.recruiter.update({
    where: { id: recruiterId },
    data: { isSampleData: !current },
  })

  revalidatePath('/support/admin/recruiters')
  revalidatePath(`/support/admin/recruiters/${recruiterId}`)
}
