'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

export async function toggleEmployerTestAccount(employerId: string, current: boolean): Promise<void> {
  await requireAdmin()

  await prisma.employerProfile.update({
    where: { id: employerId },
    data: { isSampleData: !current },
  })

  revalidatePath('/support/admin/employers')
  revalidatePath(`/support/admin/employers/${employerId}`)
}
