import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * Called when the member ticks (or un-ticks) a weekly-plan row that came from an agreed coach follow-up
 * (CommittedAction.coachFollowUpId), so the coach sees it done. Best effort: a failure here must never stop the
 * member from ticking their own to-do. Kept apart from session-notes-service so the plan code does not import it.
 */
export async function syncFollowUpFromPlan(followUpId: string, completed: boolean): Promise<void> {
  await prisma.coachFollowUp
    .updateMany({ where: { id: followUpId, ownerKind: 'member' }, data: { status: completed ? 'done' : 'open', completedAt: completed ? new Date() : null } })
    .catch((error) => console.error('Failed to sync a follow-up from the plan:', error))
}
