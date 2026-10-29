'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { makeDraftFor } from '../../../linkedin-drafts/actions'
import { postX, xConfigured } from '@/lib/social/clients'
import { filingPostText } from '@/lib/social/posts'

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

/**
 * Posts one WARN filing to X as NextChapter, by an admin's click. State records only: a press-reported layoff or a buyout is
 * refused until a second source confirms it. The notice is claimed before anything is sent, so a double click cannot post
 * twice; if X refuses, the claim is released.
 */
export async function postFilingToX(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const noticeId = String(formData.get('id') ?? '')
  const path = String(formData.get('path') ?? '')
  if (!noticeId || !/^\/layoffs\/company\/[a-z0-9-]+$/.test(path)) return
  if (!xConfigured()) return
  const n = await prisma.warnNotice.findUnique({ where: { id: noticeId }, select: { employer: true, employees: true, state: true, noticeDate: true, source: true, xPostedAt: true, dismissedAt: true } })
  if (!n || n.source === 'MANUAL_ANNOUNCEMENT' || n.dismissedAt || !n.noticeDate) return
  const claimed = await prisma.warnNotice.updateMany({ where: { id: noticeId, xPostedAt: null }, data: { xPostedAt: new Date() } })
  if (claimed.count === 0) return
  try {
    const text = filingPostText({ employer: n.employer, state: n.state, workers: n.employees, date: n.noticeDate, path }, 'utm_source=x&utm_medium=social&utm_campaign=warn-filing')
    const ref = await postX(text)
    await prisma.warnNotice.update({ where: { id: noticeId }, data: { xPostRef: ref } })
    captureServerEvent(admin.email ?? 'admin', 'layoff_posted_to_x', { noticeId, source: 'publishing_page' })
  } catch (e) {
    await prisma.warnNotice.updateMany({ where: { id: noticeId, xPostRef: null }, data: { xPostedAt: null } })
    console.error('post to X failed:', e instanceof Error ? e.message : e)
  }
  revalidatePath(BASE)
}
