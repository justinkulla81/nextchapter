import 'server-only'
import type { PrivacyTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { hasAlreadySentToday } from '@/lib/email/send-log'
import { sendCommunityCoachingDigestEmail } from '@/lib/email/send-community-coaching-digest'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// Saturday — "Your Week in Review." Skips silently for anyone with nothing
// to report rather than sending an empty digest.
export async function runCommunityDigest(introCopy: string | null, eligiblePrivacyTiers: PrivacyTier[]) {
  const windowStart = new Date(Date.now() - SEVEN_DAYS_MS)

  const eligible = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null },
      isSampleData: false,
      weeklyReportOptedOut: false,
      ...(eligiblePrivacyTiers.length > 0 ? { privacyTier: { in: eligiblePrivacyTiers } } : {}),
    },
    select: { id: true, userId: true, firstName: true, notificationTier: true },
  })

  let sentCount = 0
  for (const candidate of eligible) {
    try {
      if (!shouldSendWeeklyExtraForTier(candidate.notificationTier)) continue
      if (await hasAlreadySentToday(candidate.id, 'COMMUNITY_DIGEST')) continue

      const [encouragementCount, coachSessionCount] = await Promise.all([
        prisma.encouragementNote.count({
          where: { toCandidateId: candidate.id, sentAt: { gte: windowStart } },
        }),
        prisma.coachSession.count({
          where: { candidateId: candidate.id, occurredAt: { gte: windowStart } },
        }),
      ])

      if (encouragementCount === 0 && coachSessionCount === 0) continue

      const result = await sendCommunityCoachingDigestEmail(
        candidate,
        encouragementCount,
        coachSessionCount > 0,
        introCopy
      )
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error('Community Digest failed for candidate', candidate.id, error)
    }
  }

  return { checked: eligible.length, sent: sentCount }
}
