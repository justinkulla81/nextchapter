'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

// The schema's DRAFT -> OPEN -> CLOSED state machine has no reopen path —
// this is irreversible by design, same as the employer-side "close contest"
// action. A no-op if it's already CLOSED (idempotent, e.g. a double-click).
export async function forceCloseContest(contestId: string): Promise<void> {
  const admin = await requireAdmin()

  const contest = await prisma.crucibleContest.findUniqueOrThrow({ where: { id: contestId } })
  if (contest.state === 'CLOSED') return

  await prisma.crucibleContest.update({
    where: { id: contestId },
    data: { state: 'CLOSED', closedAt: new Date() },
  })

  captureServerEvent(admin.email ?? 'admin', 'admin_nen_contest_force_closed', { contestId })
  revalidatePath('/support/admin/nen-contests')
  revalidatePath(`/support/admin/nen-contests/${contestId}`)
}
