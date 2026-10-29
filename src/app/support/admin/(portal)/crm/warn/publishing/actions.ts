'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { makeDraftFor } from '../../../linkedin-drafts/actions'

const BASE = '/support/admin/crm/warn/publishing'

/**
 * Records by hand that a layoff was (or was not) posted on LinkedIn. It uses the same LinkedIn draft record the queue at
 * /support/admin/linkedin-drafts uses, so when posting is automatic (LinkedIn developer access) the status is already there.
 */
export async function setLinkedInPosted(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const noticeId = String(formData.get('id') ?? '')
  const posted = formData.get('posted') === '1'
  if (!noticeId) return
  if (posted) {
    if (!(await prisma.linkedInPostDraft.findUnique({ where: { noticeId }, select: { id: true } }))) await makeDraftFor(noticeId)
    await prisma.linkedInPostDraft.updateMany({ where: { noticeId }, data: { status: 'POSTED', postedAt: new Date(), skippedAt: null } })
  } else {
    await prisma.linkedInPostDraft.updateMany({ where: { noticeId, postUrn: null }, data: { status: 'DRAFT', postedAt: null } })
  }
  captureServerEvent(admin.email ?? 'admin', posted ? 'layoff_marked_posted_linkedin' : 'layoff_unmarked_posted_linkedin', { noticeId, source: 'publishing_page' })
  revalidatePath(BASE)
  revalidatePath('/support/admin/linkedin-drafts')
}

/** Records that someone asked Google to index a layoff page by hand in Search Console (Google has no API for it). */
export async function setIndexRequested(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const path = String(formData.get('path') ?? '')
  const requested = formData.get('requested') === '1'
  if (!/^\/layoffs\/company\/[a-z0-9-]+$/.test(path)) return
  if (requested) {
    await prisma.layoffIndexRequest.upsert({ where: { path }, create: { path, requestedBy: admin.email ?? null }, update: { requestedAt: new Date(), requestedBy: admin.email ?? null } })
  } else {
    await prisma.layoffIndexRequest.deleteMany({ where: { path } })
  }
  captureServerEvent(admin.email ?? 'admin', requested ? 'layoff_index_requested_marked' : 'layoff_index_requested_unmarked', { path })
  revalidatePath(BASE)
}
