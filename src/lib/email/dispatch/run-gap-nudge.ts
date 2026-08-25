import 'server-only'
import type { PrivacyTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentWeekSprint, getMondayOfWeek } from '@/lib/weekly/sprint'
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
      isSampleData: false,
      weeklyReportOptedOut: false,
      ...(eligiblePrivacyTiers.length > 0 ? { privacyTier: { in: eligiblePrivacyTiers } } : {}),
    },
    select: {
      id: true,
      userId: true,
      firstName: true,
      notificationTier: true,
      privacyTier: true,
      confidentialSearchMode: true,
      registrationCompletedAt: true,
      _count: { select: { weeklySprints: true } },
    },
  })

  const currentMonday = getMondayOfWeek(new Date())

  let sentCount = 0
  for (const candidate of eligible) {
    try {
      if (!shouldSendWeeklyExtraForTier(candidate.notificationTier)) continue
      if (await hasAlreadySentToday(candidate.id, 'GAP_NUDGE')) continue

      // A candidate who registered partway through this same week never had
      // the full week to hit the target the Sunday-deadline framing assumes
      // — nagging them on Friday for a week they joined on, say, Wednesday
      // is measuring them against days they didn't have. Give the first
      // partial week a pass; the following Friday's nudge, backed by a real
      // full week, is fair.
      if (candidate.registrationCompletedAt && candidate.registrationCompletedAt >= currentMonday) continue

      const sprint = await getCurrentWeekSprint(candidate.id)
      if (!sprint) continue // nothing committed this week

      const weekNumber = candidate._count.weeklySprints
      const { weeklyPoints, weeklyPointsTarget } = await computeWeeklyEngines(
        candidate.id,
        weekNumber,
        candidate.privacyTier,
        candidate.confidentialSearchMode
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
