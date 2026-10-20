'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'

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
