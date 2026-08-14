'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

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
  refresh()
}

export async function removeModeratedPostAction(postId: string) {
  const email = await reviewerEmail()
  await prisma.communityPost.update({
    where: { id: postId },
    data: { moderationStatus: 'REMOVED', isActive: false, moderationReviewedAt: new Date(), moderationReviewedByEmail: email },
  })
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
  refresh()
}

// Extends the candidate-report queue (reported-messages page) with real
// actions — dismissing a report never changes the post's moderation status
// or visibility, only clears the report flag.
export async function dismissPostReportAction(postId: string) {
  await requireAdmin()
  await prisma.communityPost.update({
    where: { id: postId },
    data: { reportedAt: null, reportedByCandidateId: null, reportReason: null },
  })
  revalidatePath('/support/admin/reported-messages')
}

export async function removeReportedPostAction(postId: string) {
  const email = await reviewerEmail()
  await prisma.communityPost.update({
    where: { id: postId },
    data: { moderationStatus: 'REMOVED', isActive: false, moderationReviewedAt: new Date(), moderationReviewedByEmail: email },
  })
  revalidatePath('/support/admin/reported-messages')
  revalidatePath('/dashboard/community')
}

export async function dismissThreadReportAction(threadId: string) {
  await requireAdmin()
  await prisma.messageThread.update({
    where: { id: threadId },
    data: { reportedAt: null, reportedByCandidateId: null, reportReason: null },
  })
  revalidatePath('/support/admin/reported-messages')
}
