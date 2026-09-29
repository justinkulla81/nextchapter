'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'

/** Marks a contact message handled (or back to open). */
export async function setContactHandled(id: string, handled: boolean): Promise<void> {
  const admin = await requireAdmin()
  await prisma.contactSubmission.update({
    where: { id },
    data: handled ? { handledAt: new Date(), handledBy: admin.email ?? null } : { handledAt: null, handledBy: null },
  })
  captureServerEvent(admin.email ?? 'admin', handled ? 'contact_message_handled' : 'contact_message_reopened', { submissionId: id })
  revalidatePath('/support/admin/crm/contact-messages')
}
