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
