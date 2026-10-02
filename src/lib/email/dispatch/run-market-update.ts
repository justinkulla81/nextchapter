import 'server-only'
import type { PrivacyTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { hasAlreadySentToday } from '@/lib/email/send-log'
import { getMarketConditions } from '@/lib/market'
import { sendMarketDigestCandidateEmail } from '@/lib/email/send-market-digest-candidate'
import { recordDigestSend, getDigestNuggets, markItemsSent } from '@/lib/admin/digest-composer'
import { sendWeeklyNewsletter } from '@/lib/newsletter/send-weekly'

// Tuesday — "Market Update."
export async function runMarketUpdate(introCopy: string | null, eligiblePrivacyTiers: PrivacyTier[]) {
  const eligible = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null },
      isSampleData: false,
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

  // One shared nugget for this run, same as the old cron.
  const nugget = (await getDigestNuggets('CANDIDATE', 1))[0] ?? null

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

  // The same article, to people who signed up on the site without an
  // account. Its own try: a problem with that list must not undo the record
  // of what the candidates were sent.
  let newsletterSent = 0
  try {
    // The admin's intro copy is written to candidates about their target role,
    // so the newsletter uses its own.
    newsletterSent = (await sendWeeklyNewsletter(nugget, null)).sent
  } catch (error) {
    console.error('Weekly newsletter failed', error)
  }

  if (sentCount > 0 || newsletterSent > 0) {
    if (sentCount > 0) await recordDigestSend('candidate', sentCount, nugget ? [nugget.id] : [])
    if (nugget) await markItemsSent([nugget.id], 'CANDIDATE')
  }

  return { checked: eligible.length, sent: sentCount, newsletterSent }
}
