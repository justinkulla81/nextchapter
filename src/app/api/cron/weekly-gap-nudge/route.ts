import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentWeekSprint } from '@/lib/weekly/sprint'
import { computeWeeklyEngines } from '@/lib/scoring/hireability-grade'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { sendWeeklyGapNudgeEmail } from '@/lib/email/send-weekly-gap-nudge'

// Fires Friday afternoon — only reaches candidates who are genuinely behind
// this week's target, so anyone already on track never sees a nagging email.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const eligible = await prisma.candidateProfile.findMany({
    where: { registrationCompletedAt: { not: null }, weeklyReportOptedOut: false },
    select: {
      id: true,
      userId: true,
      firstName: true,
      notificationTier: true,
      privacyTier: true,
      _count: { select: { weeklySprints: true } },
    },
  })

  let sentCount = 0
  for (const candidate of eligible) {
    try {
      if (!shouldSendWeeklyExtraForTier(candidate.notificationTier)) continue

      const sprint = await getCurrentWeekSprint(candidate.id)
      if (!sprint) continue // nothing committed this week — the goal-setting sequence already covers that gap

      // Single source of truth shared with the dashboard's own "Weekly A
      // Target" strip (see computeHireabilityGrade) — this cron used to
      // reimplement this math inline and drifted from the live dashboard
      // numbers (wrong week-number offset, missing the visibility bonus).
      // No "+1" here: `sprint` above is confirmed to exist, so
      // _count.weeklySprints already includes this week's own row.
      const weekNumber = candidate._count.weeklySprints
      const { weeklyPoints, weeklyPointsTarget } = await computeWeeklyEngines(
        candidate.id,
        weekNumber,
        candidate.privacyTier
      )

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
