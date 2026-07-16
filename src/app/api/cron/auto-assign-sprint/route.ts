import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek, getSuggestedActions, commitWeeklySprint } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { isMondayMidnightPTPassed } from '@/lib/weekly/pt-time'

// Fires Monday morning (see vercel.json, scheduled well after Monday
// midnight PT in both DST states) — any candidate who hasn't committed to a
// Sprint for the week gets the full "A-level" suggested set auto-assigned,
// so no one starts the week with literally nothing tracked.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekStartDate = getMondayOfWeek(new Date())
  if (!isMondayMidnightPTPassed(weekStartDate)) {
    return NextResponse.json({ skipped: 'Monday midnight PT has not passed yet' })
  }

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
    } catch (error) {
      console.error('Auto-assign sprint failed for candidate', candidate.id, error)
    }
  }

  return NextResponse.json({ checked: eligible.length, autoAssigned })
}
