import 'server-only'
import type { PrivacyTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentWeekSprint } from '@/lib/weekly/sprint'
import { computeWeeklyEngines } from '@/lib/scoring/dossier-competencies'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { hasAlreadySentToday } from '@/lib/email/send-log'
import { sendWeeklyGapNudgeEmail } from '@/lib/email/send-weekly-gap-nudge'

// Friday — "Close the Gap." Only reaches candidates genuinely behind this
// week's target.
export async function runGapNudge(introCopy: string | null, eligiblePrivacyTiers: PrivacyTier[]) {
  const eligible = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null },
      weeklyReportOptedOut: false,
      ...(eligiblePrivacyTiers.length > 0 ? { privacyTier: { in: eligiblePrivacyTiers } } : {}),
    },
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
      if (await hasAlreadySentToday(candidate.id, 'GAP_NUDGE')) continue

      const sprint = await getCurrentWeekSprint(candidate.id)
      if (!sprint) continue // nothing committed this week

      const weekNumber = candidate._count.weeklySprints
      const { weeklyPoints, weeklyPointsTarget } = await computeWeeklyEngines(
        candidate.id,
        weekNumber,
        candidate.privacyTier
      )

      if (weeklyPoints >= weeklyPointsTarget) continue // already at or above target

      const visibilityCheckedIn = sprint.visibilityComfort !== null
      const result = await sendWeeklyGapNudgeEmail(
        candidate,
        weeklyPoints,
        weeklyPointsTarget,
        visibilityCheckedIn,
        introCopy
      )
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error('Gap Nudge failed for candidate', candidate.id, error)
    }
  }

  return { checked: eligible.length, sent: sentCount }
}
