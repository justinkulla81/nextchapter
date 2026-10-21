import { NOT_CASUAL_WHERE } from '@/lib/journey/intensity'
import 'server-only'
import type { PrivacyTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { shouldSendRotationEmail } from '@/lib/email/notification-tier'
import { loadEngagementStates } from '@/lib/email/engagement'
import { rotationAllowedForEngagement } from '@/lib/email/engagement-state'
import { hasAlreadySentToday } from '@/lib/email/send-log'
import { sendMidweekCheckin } from '@/lib/email/send-midweek-checkin'
import { computeWeeklyGap } from '@/lib/email/weekly-gap'

// Thursday — "Midweek Check-in," now also the "where you stand" email: when a
// member is behind this week's target it leads with the points to go.
export async function runMidweekCheckin(introCopy: string | null, eligiblePrivacyTiers: PrivacyTier[]) {
  const eligible = await prisma.candidateProfile.findMany({
    where: {
      // Looking casually: no progress-pushing emails (src/lib/journey/intensity.ts).
      AND: [NOT_CASUAL_WHERE],
      registrationCompletedAt: { not: null },
      isSampleData: false,
      dailyEmailOptedOut: false,
      ...(eligiblePrivacyTiers.length > 0 ? { privacyTier: { in: eligiblePrivacyTiers } } : {}),
    },
    select: {
      id: true,
      notificationTier: true,
      privacyTier: true,
      confidentialSearchMode: true,
      registrationCompletedAt: true,
      _count: { select: { weeklySprints: true } },
    },
  })

  // Members who have stopped using the product get less email (see engagement-state.ts).
  const engagement = await loadEngagementStates(eligible.map((c) => c.id))

  let sentCount = 0
  for (const candidate of eligible) {
    try {
      if (!shouldSendRotationEmail(candidate.notificationTier, 'MIDWEEK_CHECKIN')) continue
      if (!rotationAllowedForEngagement(engagement.get(candidate.id) ?? 'active', 'MIDWEEK_CHECKIN')) continue
      if (await hasAlreadySentToday(candidate.id, 'MIDWEEK_CHECKIN')) continue

      // Behind this week's target? The email says by how much (it replaces the Friday Close the Gap email).
      const gap = await computeWeeklyGap({
        id: candidate.id,
        privacyTier: candidate.privacyTier,
        confidentialSearchMode: candidate.confidentialSearchMode,
        registrationCompletedAt: candidate.registrationCompletedAt,
        weeklySprintCount: candidate._count.weeklySprints,
      }).catch(() => null)

      const result = await sendMidweekCheckin(candidate.id, introCopy, gap)
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error('Midweek Check-in failed for candidate', candidate.id, error)
    }
  }

  return { checked: eligible.length, sent: sentCount }
}
