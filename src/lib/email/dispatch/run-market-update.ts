import 'server-only'
import type { PrivacyTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { hasAlreadySentToday } from '@/lib/email/send-log'
import { getMarketConditions } from '@/lib/market'
import { sendMarketDigestCandidateEmail } from '@/lib/email/send-market-digest-candidate'
import { recordDigestSend, getDigestNugget } from '@/lib/admin/digest-composer'

// Tuesday — "Market Update."
export async function runMarketUpdate(introCopy: string | null, eligiblePrivacyTiers: PrivacyTier[]) {
  const eligible = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null },
      marketDigestOptedOut: false,
      ...(eligiblePrivacyTiers.length > 0 ? { privacyTier: { in: eligiblePrivacyTiers } } : {}),
    },
    select: {
      id: true,
      userId: true,
      firstName: true,
      notificationTier: true,
      targetRoleType: true,
      primaryFunction: true,
      currentCity: true,
      currentState: true,
      targetIndustries: true,
    },
  })

  // One shared persona nugget for this run, same as the old cron.
  const nugget = await getDigestNugget('PERSONA_RESEARCH')

  let sentCount = 0
  for (const candidate of eligible) {
    try {
      if (!shouldSendWeeklyExtraForTier(candidate.notificationTier)) continue
      if (await hasAlreadySentToday(candidate.id, 'MARKET_UPDATE')) continue

      const marketConditions = await getMarketConditions({
        roleType: candidate.targetRoleType,
        primaryFunction: candidate.primaryFunction,
        city: candidate.currentCity,
        state: candidate.currentState,
        targetIndustries: candidate.targetIndustries,
      })

      if (!marketConditions.dataAvailable && !nugget) continue

      const result = await sendMarketDigestCandidateEmail(candidate, marketConditions, nugget, introCopy)
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error('Market Update failed for candidate', candidate.id, error)
    }
  }

  if (sentCount > 0) {
    await recordDigestSend('candidate', sentCount, nugget ? [nugget.id] : [])
  }

  return { checked: eligible.length, sent: sentCount }
}
