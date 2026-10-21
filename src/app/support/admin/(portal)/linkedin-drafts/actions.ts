'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { getAdminLinkedIn } from '@/lib/linkedin/admin-connection'
import { commentOnLinkedInPost, linkedInPostUrl, publishLinkedInShare, type LinkedInVisibility } from '@/lib/linkedin/oauth'
import { renderDraftSlides } from '@/lib/linkedin/draft-slides'
import { createDraft } from '@/lib/linkedin/layoff-post-sweep'
import { assignSlots, credibilityOf } from '@/lib/linkedin/layoff-post-rules'
import { MAX_EMPLOYEES, MIN_EMPLOYEES } from '@/lib/linkedin/layoff-post-rules'

const BASE = '/support/admin/linkedin-drafts'

/** Saves edits to the post text and first comment. */
export async function saveDraft(id: string, body: string, firstComment: string): Promise<{ message: string }> {
  const admin = await requireAdmin()
  if (!body.trim()) return { message: 'The post cannot be empty.' }
  await prisma.linkedInPostDraft.update({ where: { id }, data: { body: body.trim(), firstComment: firstComment.trim() } })
  captureServerEvent(admin.email ?? 'admin', 'linkedin_draft_edited', { draftId: id })
  revalidatePath(BASE)
  return { message: 'Saved.' }
}

/** Records that the post went out on LinkedIn. */
export async function markPosted(id: string): Promise<{ message: string }> {
  const admin = await requireAdmin()
  const d = await prisma.linkedInPostDraft.update({ where: { id }, data: { status: 'POSTED', postedAt: new Date() }, select: { angle: true, credibility: true, scheduledFor: true } })
  captureServerEvent(admin.email ?? 'admin', 'linkedin_draft_posted', { draftId: id, angle: d.angle, credibility: d.credibility, minutesFromSlot: Math.round((Date.now() - d.scheduledFor.getTime()) / 60000) })
  revalidatePath(BASE)
  return { message: 'Marked as posted.' }
}

/** Drops a draft that is not worth posting. */
export async function skipDraft(id: string): Promise<{ message: string }> {
  const admin = await requireAdmin()
  await prisma.linkedInPostDraft.update({ where: { id }, data: { status: 'SKIPPED', skippedAt: new Date() } })
  captureServerEvent(admin.email ?? 'admin', 'linkedin_draft_skipped', { draftId: id })
  revalidatePath(BASE)
  return { message: 'Skipped.' }
}

/**
 * Posts a draft to the admin's own LinkedIn profile: the text with its slides (a swipeable image set),
 * then the link as the first comment. The draft is claimed (set to POSTED)
 * before anything is sent, so a double click cannot post twice; if LinkedIn
 * refuses, it goes back to DRAFT.
 */
export async function postDraftToLinkedIn(id: string, visibility: LinkedInVisibility): Promise<{ message: string; url?: string }> {
  const admin = await requireAdmin()
  const conn = admin.email ? await getAdminLinkedIn(admin.email) : null
  if (!conn) return { message: 'LinkedIn is not connected, or the connection has expired. Connect it first.' }

  const claimed = await prisma.linkedInPostDraft.updateMany({ where: { id, status: 'DRAFT' }, data: { status: 'POSTED', postedAt: new Date() } })
  if (claimed.count === 0) return { message: 'This draft was already posted or skipped.' }
  const draft = await prisma.linkedInPostDraft.findUniqueOrThrow({ where: { id }, select: { body: true, firstComment: true, angle: true, credibility: true } })

  let postUrn: string
  try {
    const rendered = await renderDraftSlides(id)
    postUrn = await publishLinkedInShare({ accessToken: conn.accessToken, personUrn: conn.personUrn, text: draft.body, images: rendered?.pngs, visibility })
  } catch (e) {
    await prisma.linkedInPostDraft.update({ where: { id }, data: { status: 'DRAFT', postedAt: null } })
    console.error('LinkedIn post failed for draft', id, e)
    captureServerEvent(admin.email ?? 'admin', 'linkedin_draft_post_failed', { draftId: id, error: e instanceof Error ? e.message.slice(0, 200) : 'unknown' })
    return { message: `LinkedIn did not accept the post, so nothing was posted. ${e instanceof Error ? e.message.slice(0, 160) : ''}` }
  }

  await prisma.linkedInPostDraft.update({ where: { id }, data: { postUrn } })
  let commented = true
  if (draft.firstComment.trim()) {
    try {
      await commentOnLinkedInPost(conn.accessToken, conn.personUrn, postUrn, draft.firstComment)
    } catch (e) {
      commented = false
      console.error('LinkedIn first comment failed for draft', id, e)
    }
  }
  captureServerEvent(admin.email ?? 'admin', 'linkedin_draft_auto_posted', { draftId: id, angle: draft.angle, credibility: draft.credibility, visibility, commented })
  revalidatePath(BASE)
  return {
    message: commented ? 'Posted, with the link in the first comment.' : 'Posted, but the first comment failed. Paste the link as a comment yourself.',
    url: linkedInPostUrl(postUrn),
  }
}

/** Makes a draft from the largest recent state WARN filing so posting can be tried before a new layoff arrives. */
export async function createSampleDraft(): Promise<{ message: string }> {
  const admin = await requireAdmin()
  const n = await prisma.warnNotice.findFirst({
    where: { source: 'WARN_FILING', linkedinDraft: null, dismissedAt: null, employees: { gte: MIN_EMPLOYEES, lte: MAX_EMPLOYEES }, fetchedAt: { gte: new Date(Date.now() - 90 * 86_400_000) } },
    orderBy: { employees: 'desc' },
  })
  if (!n) return { message: 'No recent WARN filing of 100 jobs or more without a draft.' }
  const recent = await prisma.linkedInPostDraft.findMany({ orderBy: { createdAt: 'desc' }, take: 20, select: { angle: true, layout: true } })
  await createDraft(n, 'warn-filing', new Date(), recent.map((r) => r.angle), recent.map((r) => r.layout))
  captureServerEvent(admin.email ?? 'admin', 'linkedin_sample_draft_created', { noticeId: n.id, employer: n.employer })
  revalidatePath(BASE)
  return { message: `Made a draft for ${n.employer}.` }
}

/** Forgets the LinkedIn connection; reconnecting makes a new one. */
export async function disconnectLinkedIn(): Promise<{ message: string }> {
  const admin = await requireAdmin()
  if (admin.email) await prisma.linkedInAdminConnection.updateMany({ where: { adminEmail: admin.email }, data: { disconnectedAt: new Date() } })
  captureServerEvent(admin.email ?? 'admin', 'linkedin_disconnected', {})
  revalidatePath(BASE)
  return { message: 'Disconnected.' }
}

/**
 * Makes a draft for any layoff the admin picks from the "Other layoffs" list.
 * The weekly cap and the credibility gate do not apply: a person decided. A
 * layoff the gate would not pass is marked "unconfirmed" so the draft says so.
 */
export async function makeDraftFor(noticeId: string): Promise<{ message: string }> {
  const admin = await requireAdmin()
  const n = await prisma.warnNotice.findUnique({ where: { id: noticeId } })
  if (!n) return { message: 'That layoff no longer exists.' }
  const mentions = await prisma.layoffNewsMention.findMany({ where: { noticeId }, select: { publisher: true, headline: true } })
  const publishers = mentions.map((m) => m.publisher)
  const headlines = mentions.map((m) => m.headline)
  const why = credibilityOf({ ...n, fetchedAt: new Date() }, publishers, new Date(), headlines) ?? 'unconfirmed'
  const [recent, waiting] = await Promise.all([
    prisma.linkedInPostDraft.findMany({ orderBy: { createdAt: 'desc' }, take: 20, select: { angle: true, layout: true } }),
    prisma.linkedInPostDraft.findMany({ where: { status: 'DRAFT', scheduledFor: { gte: new Date() } }, select: { scheduledFor: true } }),
  ])
  const scheduledFor = assignSlots(1, waiting.map((w) => w.scheduledFor))[0] ?? new Date()
  const made = await createDraft(n, why, scheduledFor, recent.map((r) => r.angle), recent.map((r) => r.layout))
  captureServerEvent(admin.email ?? 'admin', 'linkedin_draft_made_by_hand', { noticeId, employer: n.employer, employees: n.employees, credibility: why })
  revalidatePath(BASE)
  return { message: made ? `Made a draft for ${n.employer}.` : 'That layoff already has a draft.' }
}
