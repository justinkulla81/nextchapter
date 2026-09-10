import 'server-only'
import type { PrivacyTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { hasAlreadySentToday } from '@/lib/email/send-log'
import { sendSearchCheckInEmail } from '@/lib/email/send-search-checkin-email'

// Saturday — "Are you still searching?" Same eligibility bar
// run-community-digest.ts used (the email this replaced): registered,
// real candidate, opted into weekly extras, and above the MINIMAL
// notification tier. Unlike that digest, this one never skips silently for
// "nothing to report" — the whole point is to ask, not to report.
export async function runSearchCheckin(introCopy: string | null, eligiblePrivacyTiers: PrivacyTier[]) {
  const eligible = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null },
      isSampleData: false,
      weeklyReportOptedOut: false,
      ...(eligiblePrivacyTiers.length > 0 ? { privacyTier: { in: eligiblePrivacyTiers } } : {}),
    },
    select: { id: true, notificationTier: true },
  })

  let sentCount = 0
  for (const candidate of eligible) {
    try {
      if (!shouldSendWeeklyExtraForTier(candidate.notificationTier)) continue
      if (await hasAlreadySentToday(candidate.id, 'SEARCH_CHECKIN')) continue

      const result = await sendSearchCheckInEmail(candidate.id, introCopy)
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error('Search Check-in failed for candidate', candidate.id, error)
    }
  }

  return { checked: eligible.length, sent: sentCount }
}
