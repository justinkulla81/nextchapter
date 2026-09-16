'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import type { ContactAdminOutreachStatus, RelationshipTag, CrmPriorityTier } from '@prisma/client'

/** The only tags this page's role multi-select edits — the candidate-facing ones (PERSONAL_FRIEND, SAME_SCHOOL, ...) are theirs, not ours to touch. */
const LEAD_TAG_VALUES: RelationshipTag[] = ['RECRUITER', 'COACH', 'HIRING_MANAGER']

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

/** Multi-select role editing — only touches the 3 lead tags, any other (candidate-facing) tag on the contact is left exactly as-is. */
export async function updateContactLeadTags(contactId: string, formData: FormData) {
  await requireAdmin()
  const selected = formData.getAll('tags').map(String) as RelationshipTag[]
  const contact = await prisma.supportNetworkContact.findUniqueOrThrow({
    where: { id: contactId },
    select: { relationshipTags: true },
  })
  const preserved = contact.relationshipTags.filter((t) => !LEAD_TAG_VALUES.includes(t))
  await prisma.supportNetworkContact.update({
    where: { id: contactId },
    data: { relationshipTags: { set: [...preserved, ...selected] } },
  })
  revalidatePath('/support/admin/network-leads')
}

/** "X" — hides this row from every lead table without touching relationshipTags or the candidate-facing removedAt. */
export async function dismissNetworkLead(contactId: string) {
  await requireAdmin()
  await prisma.supportNetworkContact.update({ where: { id: contactId }, data: { leadDismissedAt: new Date() } })
  revalidatePath('/support/admin/network-leads')
}

export async function setNetworkLeadPriority(contactId: string, tier: CrmPriorityTier | null) {
  await requireAdmin()
  await prisma.supportNetworkContact.update({ where: { id: contactId }, data: { adminPriority: tier } })
  revalidatePath('/support/admin/network-leads')
}
