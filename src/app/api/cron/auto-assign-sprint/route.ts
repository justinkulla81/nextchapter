import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek, getSuggestedActions, commitWeeklySprint } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { captureServerEvent } from '@/lib/posthog/server'

// Fires Monday ~5am ET (fixed UTC time, see vercel.json — drifts an hour
// across the DST transition, accepted tradeoff over a wall-clock-exact
// check). Goal-setting is no longer a candidate action at all: every week's
// Search Actions are auto-assigned here, unconditionally, from the same
// suggestion engine the old manual "I Commit" flow used to surface.
// Sending the "Morning Motivation" recap+preview email is the
// candidate-email-dispatch cron's job (runMorningMotivation reads the
// WeeklySprint row this creates) — this route only does assignment.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekStartDate = getMondayOfWeek(new Date())

  const eligible = await prisma.candidateProfile.findMany({
    where: { registrationCompletedAt: { not: null } },
    select: { id: true, _count: { select: { weeklySprints: true } } },
  })

  let autoAssigned = 0
  for (const candidate of eligible) {
    try {
      const existing = await prisma.weeklySprint.findUnique({
        where: { candidateId_weekStartDate: { candidateId: candidate.id, weekStartDate } },
      })
      if (existing) continue

      const weekNumber = candidate._count.weeklySprints + 1

      const suggestedActions = await getSuggestedActions(candidate.id, weekNumber)
      if (suggestedActions.length === 0) continue

      const actions = suggestedActions.map((a) => {
        const effort = estimateActionEffort(a)
        return { text: a.text, actionType: a.actionType, points: effort.points, estimatedMinutes: effort.minutes }
      })
      await commitWeeklySprint(candidate.id, actions, true)
      autoAssigned += 1
      captureServerEvent(candidate.id, 'weekly_sprint_submitted', {
        weekNumber,
        actionCount: actions.length,
        committedPoints: actions.reduce((sum, a) => sum + a.points, 0),
        autoAssigned: true,
      })
    } catch (error) {
      console.error('Auto-assign sprint failed for candidate', candidate.id, error)
    }
  }

  return NextResponse.json({ checked: eligible.length, autoAssigned })
}
