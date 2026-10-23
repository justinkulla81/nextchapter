import 'server-only'
import { prisma } from '@/lib/prisma'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { sendUpgradeOffer } from '@/lib/email/send-upgrade-offer'
import { loadOfferSignals } from '@/lib/upgrade-offer/signals'
import { eligibleTriggers, offerAllowed, pickTrigger } from '@/lib/upgrade-offer/triggers'

// Weekly. Offers the paid coaching plan to free members whose own numbers show a need
// (small market, quiet network, long search). Spacing and caps live in triggers.ts.
export async function runUpgradeOffer(now = new Date()) {
  const candidates = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null },
      isSampleData: false,
      deactivatedAt: null,
      upgradeOfferOptedOut: false,
      membershipSubscription: { is: null },
    },
    select: { id: true, email: true, firstName: true, notificationTier: true, registrationCompletedAt: true },
  })

  let sent = 0
  for (const c of candidates) {
    try {
      // Only the full schedule gets offers; anyone who asked for fewer emails does not.
      if (c.notificationTier !== 'FULL' || !shouldSendWeeklyExtraForTier(c.notificationTier)) continue
      const tenureDays = Math.floor((now.getTime() - c.registrationCompletedAt!.getTime()) / 86_400_000)
      const history = await prisma.candidateEmailSendLog.findMany({ where: { candidateId: c.id, emailKey: 'UPGRADE_OFFER' }, select: { sentAt: true } })
      const sentAt = history.map((h) => h.sentAt)
      if (!offerAllowed({ sentAt }, tenureDays, now)) continue
      const signals = await loadOfferSignals(c, now)
      const trigger = pickTrigger(eligibleTriggers(signals), sentAt.length)
      if (!trigger) continue
      if ((await sendUpgradeOffer(c, trigger, signals)).sent) sent += 1
    } catch (error) {
      console.error('Upgrade offer failed for candidate', c.id, error)
    }
  }
  return { checked: candidates.length, sent }
}
