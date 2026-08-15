import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek, type CommittedAction } from '@/lib/weekly/sprint'
import { captureServerEvent } from '@/lib/posthog/server'

const DIRECTIVE_POINTS = 15
const DIRECTIVE_MINUTES = 15

// Master Build Script §A5.2 — "action items pushed into the client's Search
// Action Plan." The Search Action Plan IS the candidate's current-week
// WeeklySprint.committedActions (the same JSON blob SuccessSprintCard/
// ActionPlanBox already render — see src/app/dashboard/page.tsx's
// `currentSprint.committedActions` prop) — there is no separate "plan"
// surface to build; this closes the actual gap the investigation found,
// where `directives` sat as free text a coach wrote but nothing pushed it
// anywhere the candidate would see it as a real, trackable item.
//
// Splits the coach's free-text directives into one action-plan row per
// non-empty line, and appends them to the candidate's current week (create
// the week's row if the candidate hasn't started a sprint yet — a coach
// directive should never silently go nowhere just because it's a brand-new
// client's first week). Each row gets the small fixed point value +
// `fromCoach: true` so the candidate can mark real progress on it via the
// exact same toggleSprintActionCompletion path every other action row uses.
export async function pushDirectivesToActionPlan(
  candidateId: string,
  directivesText: string,
  sessionId: string
): Promise<number> {
  const lines = directivesText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return 0

  const weekStartDate = getMondayOfWeek(new Date())
  const existing = await prisma.weeklySprint.findUnique({
    where: { candidateId_weekStartDate: { candidateId, weekStartDate } },
  })

  const newRows: CommittedAction[] = lines.map((text) => ({
    text,
    points: DIRECTIVE_POINTS,
    estimatedMinutes: DIRECTIVE_MINUTES,
    completed: false,
    recurring: false,
    addedFromCatalog: true,
    fromCoach: true,
    coachSessionId: sessionId,
  }))

  if (!existing) {
    await prisma.weeklySprint.create({
      data: {
        candidateId,
        weekStartDate,
        committedActions: newRows as unknown as Prisma.InputJsonValue,
        autoAssigned: false,
      },
    })
  } else {
    const actions = existing.committedActions as unknown as CommittedAction[]
    await prisma.weeklySprint.update({
      where: { id: existing.id },
      data: { committedActions: [...actions, ...newRows] as unknown as Prisma.InputJsonValue },
    })
  }

  captureServerEvent(candidateId, 'coach_directive_added_to_action_plan', {
    sessionId,
    lineCount: lines.length,
  })

  return lines.length
}
