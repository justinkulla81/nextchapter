import 'server-only'
import type { PrivacyTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { hasAlreadySentToday } from '@/lib/email/send-log'
import { sendDailyActionEmail } from '@/lib/email/send-daily-action-email'

// Wednesday — "Daily Nudge" (the generic one-thing-today email).
export async function runDailyNudge(introCopy: string | null, eligiblePrivacyTiers: PrivacyTier[]) {
  const eligible = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null },
      dailyEmailOptedOut: false,
      ...(eligiblePrivacyTiers.length > 0 ? { privacyTier: { in: eligiblePrivacyTiers } } : {}),
    },
    select: { id: true, notificationTier: true },
  })

  let sentCount = 0
  for (const candidate of eligible) {
    try {
      if (!shouldSendWeeklyExtraForTier(candidate.notificationTier)) continue
      if (await hasAlreadySentToday(candidate.id, 'DAILY_NUDGE')) continue

      const result = await sendDailyActionEmail(candidate.id, introCopy)
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error('Daily Nudge failed for candidate', candidate.id, error)
    }
  }

  return { checked: eligible.length, sent: sentCount }
}
