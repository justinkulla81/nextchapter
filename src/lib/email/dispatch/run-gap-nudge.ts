import { NOT_CASUAL_WHERE } from '@/lib/journey/intensity'
import 'server-only'
import type { PrivacyTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeWeeklyGap } from '@/lib/email/weekly-gap'
import { shouldSendRotationEmail } from '@/lib/email/notification-tier'
import { hasAlreadySentToday } from '@/lib/email/send-log'
import { sendWeeklyGapNudgeEmail } from '@/lib/email/send-weekly-gap-nudge'

// Friday — "Close the Gap." Only reaches candidates genuinely behind this
// week's target.
export async function runGapNudge(introCopy: string | null, eligiblePrivacyTiers: PrivacyTier[]) {
  const eligible = await prisma.candidateProfile.findMany({
    where: {
      // Looking casually: no progress-pushing emails (src/lib/journey/intensity.ts).
      AND: [NOT_CASUAL_WHERE],
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

  let sentCount = 0
  for (const candidate of eligible) {
    try {
      if (!shouldSendRotationEmail(candidate.notificationTier, 'GAP_NUDGE')) continue
      if (await hasAlreadySentToday(candidate.id, 'GAP_NUDGE')) continue

      const gap = await computeWeeklyGap({
        id: candidate.id,
        privacyTier: candidate.privacyTier,
        confidentialSearchMode: candidate.confidentialSearchMode,
        registrationCompletedAt: candidate.registrationCompletedAt,
        weeklySprintCount: candidate._count.weeklySprints,
      })
      if (!gap) continue // not behind this week's target, or nothing to measure

      const result = await sendWeeklyGapNudgeEmail(candidate, gap.weeklyPoints, gap.weeklyPointsTarget, introCopy)
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error('Gap Nudge failed for candidate', candidate.id, error)
    }
  }

  return { checked: eligible.length, sent: sentCount }
}
