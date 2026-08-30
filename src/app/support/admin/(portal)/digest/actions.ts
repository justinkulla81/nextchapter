'use server'

import { revalidatePath } from 'next/cache'
import type { DigestAudience } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { prisma } from '@/lib/prisma'
import { ingestResearchUrl } from '@/lib/research/ingest'
import { sendProductPositioningFlagEmail } from '@/lib/email/send-product-positioning-flag'

export async function markResearchItemStatus(id: string, status: 'reviewed' | 'actioned' | 'dismissed') {
  const admin = await requireAdmin()
  await prisma.researchLibraryItem.update({ where: { id }, data: { status } })
  captureServerEvent(admin?.email ?? 'admin', 'research_item_status_updated', { itemId: id, status })
  revalidatePath('/support/admin/digest')
}

// Replaces the whole set at once — the admin UI submits every checked
// audience together, not one toggle per audience, since "which audiences"
// is a single decision made per article, not N independent ones.
export async function setDigestAudiences(id: string, audiences: DigestAudience[]) {
  const admin = await requireAdmin()
  await prisma.researchLibraryItem.update({ where: { id }, data: { digestAudiences: audiences } })
  captureServerEvent(admin?.email ?? 'admin', 'research_item_digest_audiences_updated', { itemId: id, audiences })
  revalidatePath('/support/admin/digest')
}

export async function removeFromDigestQueue(id: string) {
  const admin = await requireAdmin()
  await prisma.researchLibraryItem.update({ where: { id }, data: { digestAudiences: [] } })
  captureServerEvent(admin?.email ?? 'admin', 'research_item_digest_audiences_updated', { itemId: id, audiences: [] })
  revalidatePath('/support/admin/digest')
}

export async function flagProductPositioning(id: string) {
  const admin = await requireAdmin()
  const item = await prisma.researchLibraryItem.findUniqueOrThrow({ where: { id } })
  await sendProductPositioningFlagEmail({
    title: item.title,
    url: item.url,
    summary: item.summary,
    suggestedAction: item.suggestedAction,
  })
  captureServerEvent(admin?.email ?? 'admin', 'research_item_positioning_flagged', { itemId: id })
  revalidatePath('/support/admin/digest')
}

export async function disconnectGoogleInbox() {
  const admin = await requireAdmin()
  await prisma.googleInboxConnection.deleteMany({})
  captureServerEvent(admin?.email ?? 'admin', 'google_inbox_disconnected')
  revalidatePath('/support/admin/digest')
}

export async function addResearchItem(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const admin = await requireAdmin()
  const url = String(formData.get('url') ?? '').trim()

  if (!url || !/^https?:\/\//i.test(url)) {
    return { error: 'Enter a valid URL starting with http:// or https://.' }
  }

  const item = await ingestResearchUrl(url, 'manual')

  captureServerEvent(admin?.email ?? 'admin', 'research_item_ingested', {
    itemId: item.id,
    source: 'manual',
    bucket: item.bucket,
    needsReview: item.needsReview,
  })

  revalidatePath('/support/admin/digest')
  return { success: true }
}
