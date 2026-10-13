import 'server-only'
import type { PrivacyTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { hasAlreadySentToday } from '@/lib/email/send-log'
import { sendFinishLineEmail } from '@/lib/email/send-finish-line-email'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// Sunday — "Finish Line," now also carrying the merged "week in review"
// content (encouragement notes + coach sessions) that used to be its own
// Saturday email (COMMUNITY_DIGEST, retired — see that email key's schema
// comment). Unlike the old digest, this never skips for "nothing to
// report" — Finish Line's own weekly-progress recap is always relevant;
// the community/coaching content is purely additive when there's something
// to say.
export async function runFinishLine(introCopy: string | null, eligiblePrivacyTiers: PrivacyTier[]) {
  const windowStart = new Date(Date.now() - SEVEN_DAYS_MS)

  const eligible = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null },
      isSampleData: false,
      dailyEmailOptedOut: false,
      ...(eligiblePrivacyTiers.length > 0 ? { privacyTier: { in: eligiblePrivacyTiers } } : {}),
    },
    select: { id: true, notificationTier: true },
  })

  let sentCount = 0
  for (const candidate of eligible) {
    try {
      if (!shouldSendWeeklyExtraForTier(candidate.notificationTier)) continue
      if (await hasAlreadySentToday(candidate.id, 'FINISH_LINE')) continue

      const [encouragementCount, coachSessionCount] = await Promise.all([
        prisma.encouragementNote.count({
          where: { toCandidateId: candidate.id, sentAt: { gte: windowStart } },
        }),
        prisma.coachSession.count({
          where: { candidateId: candidate.id, occurredAt: { gte: windowStart } },
        }),
      ])

      const result = await sendFinishLineEmail(candidate.id, introCopy, encouragementCount, coachSessionCount > 0)
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error('Finish Line failed for candidate', candidate.id, error)
    }
  }

  return { checked: eligible.length, sent: sentCount }
}
