'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import type { ContactAdminOutreachStatus, RelationshipTag } from '@prisma/client'

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

// "Remove" on this page means "not actually a recruiter/coach/hiring
// manager" — it only strips that one lead-list tag, never the underlying
// SupportNetworkContact row, since that's the candidate's own contact and
// still belongs on their Network page regardless of what NextChapter's own
// business-development classification got wrong.
export async function removeLeadTag(contactId: string, tag: RelationshipTag) {
  await requireAdmin()
  const contact = await prisma.supportNetworkContact.findUniqueOrThrow({
    where: { id: contactId },
    select: { relationshipTags: true },
  })
  await prisma.supportNetworkContact.update({
    where: { id: contactId },
    data: { relationshipTags: { set: contact.relationshipTags.filter((t) => t !== tag) } },
  })
  revalidatePath('/support/admin/network-leads')
}
