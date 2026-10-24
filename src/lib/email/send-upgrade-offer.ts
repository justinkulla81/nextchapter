import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { prisma } from '@/lib/prisma'
import { recordCandidateEmailSent } from '@/lib/email/send-log'
import { candidateUnsubscribeUrl } from '@/lib/email/signed-links'
import { captureServerEvent } from '@/lib/posthog/server'
import UpgradeOfferEmail from '@/emails/upgrade-offer'
import { offerCopy, type OfferSignals, type OfferTrigger } from '@/lib/upgrade-offer/triggers'

const PLAN_KEY = 'dtc_coaching_plus'
const PLAN_NAME = 'Coaching Plus'

export async function sendUpgradeOffer(
  candidate: { id: string; email: string | null; firstName: string | null },
  trigger: OfferTrigger,
  signals: OfferSignals,
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping upgrade offer email.')
    return { sent: false as const }
  }
  if (!candidate.email) return { sent: false as const }

  // Claim first: a duplicate cron fire cannot send twice in a day.
  if (!(await recordCandidateEmailSent(candidate.id, 'UPGRADE_OFFER'))) return { sent: false as const }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const copy = offerCopy(trigger, signals, candidate.firstName)
  const ctaUrl = `${appUrl}/dashboard/membership?utm_source=email&utm_medium=upgrade_offer&utm_campaign=${trigger}`

  const { error } = await createResend(process.env.RESEND_API_KEY).emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: candidate.email,
    subject: copy.subject,
    react: UpgradeOfferEmail({
      copy,
      planName: PLAN_NAME,
      ctaUrl,
      unsubscribeUrl: candidateUnsubscribeUrl(appUrl, candidate.id, 'upgradeOffer'),
    }),
  })
  if (error) {
    console.error('Failed to send upgrade offer email:', error)
    // Release the claim so the next run can try again.
    await prisma.candidateEmailSendLog.deleteMany({ where: { candidateId: candidate.id, emailKey: 'UPGRADE_OFFER', sentForDate: { gte: new Date(Date.now() - 86_400_000) } } }).catch(() => {})
    return { sent: false as const }
  }
  captureServerEvent(candidate.id, 'upgrade_offer_emailed', { trigger, plan_key: PLAN_KEY })
  return { sent: true as const }
}
