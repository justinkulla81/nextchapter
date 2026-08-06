'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import type { ContactAdminOutreachStatus } from '@prisma/client'

export async function updateContactOutreachStatus(contactId: string, status: ContactAdminOutreachStatus) {
  await requireAdmin()
  await prisma.supportNetworkContact.update({
    where: { id: contactId },
    data: { adminOutreachStatus: status },
  })
  revalidatePath('/support/admin/network-leads')
}

export async function updateContactAdminNotes(contactId: string, formData: FormData) {
  await requireAdmin()
  const notes = (formData.get('notes') as string | null)?.trim() || null
  await prisma.supportNetworkContact.update({
    where: { id: contactId },
    data: { adminNotes: notes },
  })
  revalidatePath('/support/admin/network-leads')
}
