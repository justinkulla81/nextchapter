'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

// The only genuinely new action this page needs — every other request
// source (bounty claims, reference disputes) already has its own
// resolution action on its existing page; this one links there instead of
// duplicating that logic.
export async function markJobBoardIntroRequestStatus(id: string, status: 'contacted' | 'closed') {
  const admin = await requireAdmin()
  await prisma.jobBoardIntroRequest.update({ where: { id }, data: { status } })
  captureServerEvent(admin?.email ?? 'admin', 'job_board_intro_request_status_updated', { requestId: id, status })
  revalidatePath('/support/admin/requests')
}

// Imported review stats: confirm (full credit, "Confirmed by NextChapter") or
// reject (no credit). Rejecting only after looking at the public profile or
// the screenshot.
export async function decideImportedReviews(id: string, decision: 'CONFIRMED' | 'REJECTED') {
  const admin = await requireAdmin()
  const row = await prisma.externalReviewStat.update({
    where: { id },
    data: {
      status: decision,
      reviewedBy: admin?.email ?? 'admin',
      reviewedAt: new Date(),
      checkNote: decision === 'CONFIRMED' ? 'Confirmed by NextChapter.' : 'We could not confirm these numbers on your public profile.',
    },
    select: { candidateId: true, platform: true },
  })
  captureServerEvent(admin?.email ?? 'admin', 'external_reviews_reviewed', { id, decision, platform: row.platform, candidateId: row.candidateId })
  revalidatePath('/support/admin/requests')
}
