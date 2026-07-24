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
