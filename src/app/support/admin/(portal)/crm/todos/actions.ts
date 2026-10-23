'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'

/** Marks a to-do done (or back to open). Its Google reminder, if any, is left as it was. */
export async function setTodoDone(taskId: string, done: boolean): Promise<void> {
  const admin = await requireAdmin()
  const task = await prisma.crmTask.update({
    where: { id: taskId },
    data: done ? { status: 'DONE', completedAt: new Date() } : { status: 'OPEN', completedAt: null },
    select: { id: true, sourceRef: true, personId: true, opportunityId: true },
  })
  captureServerEvent(admin.email ?? 'admin', done ? 'crm_todo_completed' : 'crm_todo_reopened', {
    taskId: task.id, fromMeeting: !!task.sourceRef, personId: task.personId, opportunityId: task.opportunityId,
  })
  revalidatePath('/support/admin/crm/todos')
}
