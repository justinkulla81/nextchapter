'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

async function reviewerEmail(): Promise<string | null> {
  const user = await requireAdmin()
  return user.email ?? null
}

function refresh() {
  revalidatePath('/support/admin/community-moderation')
  revalidatePath('/dashboard/community')
}

// Publishes a HELD post, or restores a REMOVED one — the same "make it
// visible" action either way, distinguished only by which section of the
// queue it was called from.
export async function publishModeratedPostAction(postId: string) {
  const email = await reviewerEmail()
  await prisma.communityPost.update({
    where: { id: postId },
    data: { moderationStatus: 'PUBLISHED', isActive: true, moderationReviewedAt: new Date(), moderationReviewedByEmail: email },
  })
  captureServerEvent(email ?? 'admin', 'admin_moderated_post_published', { postId })
  refresh()
}

export async function removeModeratedPostAction(postId: string) {
  const email = await reviewerEmail()
  await prisma.communityPost.update({
    where: { id: postId },
    data: { moderationStatus: 'REMOVED', isActive: false, moderationReviewedAt: new Date(), moderationReviewedByEmail: email },
  })
  captureServerEvent(email ?? 'admin', 'admin_moderated_post_removed', { postId })
  refresh()
}

// For published-but-flagged posts (crisis, bad legal/financial advice) —
// acknowledges a human looked at it without changing whether it's visible.
// Clears it from the "needs review" queue.
export async function acknowledgeModeratedPostAction(postId: string) {
  const email = await reviewerEmail()
  await prisma.communityPost.update({
    where: { id: postId },
    data: { moderationReviewedAt: new Date(), moderationReviewedByEmail: email },
  })
  captureServerEvent(email ?? 'admin', 'admin_moderated_post_acknowledged', { postId })
  refresh()
}

// Extends the candidate-report queue (reported-messages page) with real
// actions — dismissing a report never changes the post's moderation status
// or visibility, only clears the report flag.
export async function dismissPostReportAction(postId: string) {
  const admin = await requireAdmin()
  await prisma.communityPost.update({
    where: { id: postId },
    data: { reportedAt: null, reportedByCandidateId: null, reportReason: null },
  })
  captureServerEvent(admin.email ?? 'admin', 'admin_post_report_dismissed', { postId })
  revalidatePath('/support/admin/reported-messages')
}

export async function removeReportedPostAction(postId: string) {
  const email = await reviewerEmail()
  await prisma.communityPost.update({
    where: { id: postId },
    data: { moderationStatus: 'REMOVED', isActive: false, moderationReviewedAt: new Date(), moderationReviewedByEmail: email },
  })
  captureServerEvent(email ?? 'admin', 'admin_reported_post_removed', { postId })
  revalidatePath('/support/admin/reported-messages')
  revalidatePath('/dashboard/community')
}

export async function dismissThreadReportAction(threadId: string) {
  const admin = await requireAdmin()
  await prisma.messageThread.update({
    where: { id: threadId },
    data: { reportedAt: null, reportedByCandidateId: null, reportReason: null },
  })
  captureServerEvent(admin.email ?? 'admin', 'admin_thread_report_dismissed', { threadId })
  revalidatePath('/support/admin/reported-messages')
}

// "A hard situation at work" questions and replies (src/lib/work-help). Same three moves as for posts: dismiss a
// report, publish a held item, or remove one. They live in their own tables, so they are separate actions.
type WorkItemType = 'question' | 'reply'

async function updateWorkItem(type: WorkItemType, id: string, data: Record<string, unknown>) {
  if (type === 'question') await prisma.workQuestion.update({ where: { id }, data })
  else await prisma.workQuestionReply.update({ where: { id }, data })
}

function refreshWork() {
  revalidatePath('/support/admin/reported-messages')
  revalidatePath('/dashboard/work-help')
}

export async function dismissWorkReportAction(type: WorkItemType, id: string) {
  const admin = await requireAdmin()
  await updateWorkItem(type, id, { reportedAt: null, reportedByCandidateId: null, reportReason: null })
  captureServerEvent(admin.email ?? 'admin', 'admin_work_report_dismissed', { type, id })
  refreshWork()
}

export async function approveWorkItemAction(type: WorkItemType, id: string) {
  const email = await reviewerEmail()
  await updateWorkItem(type, id, { moderationStatus: 'PUBLISHED', isActive: true, reportedAt: null, reportedByCandidateId: null, reportReason: null })
  captureServerEvent(email ?? 'admin', 'admin_work_item_approved', { type, id })
  refreshWork()
}

export async function removeWorkItemAction(type: WorkItemType, id: string) {
  const email = await reviewerEmail()
  await updateWorkItem(type, id, { moderationStatus: 'REMOVED', isActive: false })
  captureServerEvent(email ?? 'admin', 'admin_work_item_removed', { type, id })
  refreshWork()
}
