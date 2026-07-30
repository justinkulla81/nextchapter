import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek, type CommittedAction } from '@/lib/weekly/sprint'
import { pointsNeededForA } from '@/lib/weekly/action-effort'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { sendWeeklyGapNudgeEmail } from '@/lib/email/send-weekly-gap-nudge'

// Fires Friday afternoon — only reaches candidates who are genuinely behind
// this week's target, so anyone already on track never sees a nagging email.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekStartDate = getMondayOfWeek(new Date())

  const eligible = await prisma.candidateProfile.findMany({
    where: { registrationCompletedAt: { not: null }, weeklyReportOptedOut: false },
    select: {
      id: true,
      userId: true,
      firstName: true,
      notificationTier: true,
      _count: { select: { weeklySprints: true } },
    },
  })

  let sentCount = 0
  for (const candidate of eligible) {
    try {
      if (!shouldSendWeeklyExtraForTier(candidate.notificationTier)) continue

      const sprint = await prisma.weeklySprint.findUnique({
        where: { candidateId_weekStartDate: { candidateId: candidate.id, weekStartDate } },
      })
      if (!sprint) continue // nothing committed this week — the goal-setting sequence already covers that gap

      const weekNumber = candidate._count.weeklySprints
      const weeklyPointsTarget = pointsNeededForA(weekNumber)
      const actions = sprint.committedActions as unknown as CommittedAction[]
      const weeklyPoints = actions.filter((a) => a.completed).reduce((sum, a) => sum + a.points, 0)

      if (weeklyPoints >= weeklyPointsTarget) continue // already at or above target — no nudge needed

      const visibilityCheckedIn = sprint.visibilityComfort !== null
      const result = await sendWeeklyGapNudgeEmail(candidate, weeklyPoints, weeklyPointsTarget, visibilityCheckedIn)
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error('Weekly gap nudge failed for candidate', candidate.id, error)
    }
  }

  return NextResponse.json({ checked: eligible.length, sent: sentCount })
}
