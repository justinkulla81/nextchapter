'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { CHANNELS, type Channel } from '@/lib/content/card'

const BASE = '/support/admin/content-drafts'

/** Records that a draft went out on one channel, with the live post's address. Nothing is posted from here. */
export async function markPosted(draftId: string, channel: string, url: string): Promise<{ message: string }> {
  const admin = await requireAdmin()
  if (!CHANNELS.includes(channel as Channel)) return { message: 'Pick a channel.' }
  let parsed: URL
  try { parsed = new URL(url.trim()) } catch { return { message: 'Paste the full https address of the post.' } }
  if (parsed.protocol !== 'https:') return { message: 'Paste the full https address of the post.' }
  const draft = await prisma.contentDraft.findUnique({ where: { id: draftId }, select: { kind: true, day: true } })
  if (!draft) return { message: 'That draft is gone.' }
  await prisma.$transaction([
    prisma.contentDraftPost.create({ data: { draftId, channel, url: parsed.toString() } }),
    prisma.contentDraft.update({ where: { id: draftId }, data: { status: 'POSTED' } }),
  ])
  captureServerEvent(admin.email ?? 'admin', 'content_draft_posted', { draftId, channel, kind: draft.kind, day: draft.day })
  revalidatePath(BASE)
  return { message: `Marked as posted on ${channel}.` }
}

/** Drops a draft that is not worth posting. */
export async function skipDraft(draftId: string): Promise<{ message: string }> {
  const admin = await requireAdmin()
  const d = await prisma.contentDraft.update({ where: { id: draftId }, data: { status: 'SKIPPED' }, select: { kind: true } })
  captureServerEvent(admin.email ?? 'admin', 'content_draft_skipped', { draftId, kind: d.kind })
  revalidatePath(BASE)
  return { message: 'Skipped.' }
}

/** Puts a skipped draft back in the queue. */
export async function reopenDraft(draftId: string): Promise<{ message: string }> {
  const admin = await requireAdmin()
  const posts = await prisma.contentDraftPost.count({ where: { draftId } })
  await prisma.contentDraft.update({ where: { id: draftId }, data: { status: posts ? 'POSTED' : 'DRAFT' } })
  captureServerEvent(admin.email ?? 'admin', 'content_draft_reopened', { draftId })
  revalidatePath(BASE)
  return { message: 'Back in the queue.' }
}
