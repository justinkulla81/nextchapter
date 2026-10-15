import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek, type CommittedAction } from '@/lib/weekly/sprint'

// Adds a feedback action item to this week's plan as a text-only row, the same
// lane coach directives use (no actionType, so nothing is scored from it).
// It carries 0 points on purpose: feedback follow-through should not move the
// Search Action Grade. Never creates a sprint: a first sprint changes grading
// from "not started" to graded, which is not this feature's call.
export async function addFeedbackActionToSprint(
  candidateId: string,
  text: string,
): Promise<{ added: true } | { added: false; reason: 'no_sprint' | 'duplicate' }> {
  const weekStartDate = getMondayOfWeek(new Date())
  const sprint = await prisma.weeklySprint.findUnique({
    where: { candidateId_weekStartDate: { candidateId, weekStartDate } },
  })
  if (!sprint) return { added: false, reason: 'no_sprint' }
  const actions = sprint.committedActions as unknown as CommittedAction[]
  if (actions.some((a) => a.fromInWork && a.text === text)) return { added: false, reason: 'duplicate' }
  const row: CommittedAction = {
    text,
    points: 0,
    estimatedMinutes: 15,
    completed: false,
    recurring: false,
    addedFromCatalog: true,
    fromInWork: true,
  }
  await prisma.weeklySprint.update({
    where: { id: sprint.id },
    data: { committedActions: [...actions, row] as unknown as Prisma.InputJsonValue },
  })
  return { added: true }
}
