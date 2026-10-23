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

/** Adds a to-do by hand. Due date is optional (YYYY-MM-DD); it is stored at 9:00 ET like the meeting ones. */
export async function addTodo(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const title = String(formData.get('title') ?? '').trim().slice(0, 300)
  if (!title) return
  const due = String(formData.get('dueDate') ?? '')
  const notes = String(formData.get('notes') ?? '').trim() || null
  const task = await prisma.crmTask.create({
    data: {
      title, notes, kind: 'FOLLOW_UP', ownerEmail: admin.email ?? null,
      dueAt: /^\d{4}-\d{2}-\d{2}$/.test(due) ? new Date(`${due}T13:00:00Z`) : null,
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_todo_added', { taskId: task.id, hasDueDate: !!task.dueAt })
  revalidatePath('/support/admin/crm/todos')
}
