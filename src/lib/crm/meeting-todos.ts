import 'server-only'
import { prisma } from '@/lib/prisma'
import { createReminderEvent } from '@/lib/google/admin-calendar'
import { parseNextSteps } from '@/lib/google/meeting-notes'

/** Two days after the meeting, moved to Monday when that lands on a weekend. */
export function dueDateAfterMeeting(meetingAt: Date): string {
  const d = new Date(Date.UTC(meetingAt.getUTCFullYear(), meetingAt.getUTCMonth(), meetingAt.getUTCDate() + 2))
  if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 2)
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Turns a meeting's Gemini "Next steps" into CRM to-dos on the person,
 * their organization and opportunity. Yours get a Google Calendar reminder;
 * the other party's become "Waiting on" items so you can chase them.
 *
 * Idempotent: a step is keyed `<event>:<n>`, so reading the same notes again
 * (or the same call from the other connected account) adds nothing.
 */
export async function createTodosFromNotes(input: {
  notes: string
  eventId: string
  eventTitle: string
  meetingAt: Date
  notesUrl: string
  personId: string
  personName: string
  orgId: string | null
  opportunityId: string | null
  selfNames: string[]
  accessToken: string
}): Promise<{ created: number; reminders: number }> {
  const steps = parseNextSteps(input.notes, input.selfNames)
  const dueDate = dueDateAfterMeeting(input.meetingAt)
  let created = 0
  let reminders = 0
  for (const [i, step] of steps.entries()) {
    const sourceRef = `${input.eventId}:${i}`
    if (await prisma.crmTask.findUnique({ where: { sourceRef }, select: { id: true } })) continue
    const title = step.mine ? step.title : `Waiting on ${step.owner ?? input.personName}: ${step.title}`
    const notes = [step.detail, `From "${input.eventTitle}" — notes: ${input.notesUrl}`].filter(Boolean).join('\n')
    const task = await prisma.crmTask.create({
      data: {
        title, notes, kind: step.mine ? 'FOLLOW_UP' : 'ADMIN', dueAt: new Date(`${dueDate}T13:00:00Z`),
        personId: input.personId, orgId: input.orgId, opportunityId: input.opportunityId, sourceRef,
      },
    })
    created++
    if (!step.mine) continue
    try {
      const googleEventId = await createReminderEvent(input.accessToken, {
        title: step.title,
        description: `${notes}\n\nPerson: ${input.personName}`,
        dueDate,
      })
      await prisma.crmTask.update({ where: { id: task.id }, data: { googleEventId } })
      reminders++
    } catch {
      // The to-do exists on the NC list either way; a missing calendar
      // reminder is not worth failing the sweep over.
    }
  }
  return { created, reminders }
}
