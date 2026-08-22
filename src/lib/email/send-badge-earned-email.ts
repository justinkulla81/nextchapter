// Fired only for badges genuinely new this call — see
// persistWeeklyBadgesAndNotify/persistMilestoneBadgesAndNotify in
// badge-notifications.ts, which diff against what's already persisted
// before upserting. Event-triggered, not part of the CandidateEmailKey
// daily rotation, same precedent as send-grade-calibrated-up-email.ts.
import 'server-only'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import BadgeEarnedEmail from '@/emails/badge-earned'

export async function sendBadgeEarnedEmail(
  candidate: { id: string; userId: string; firstName: string | null },
  badgeLabels: string[]
) {
  if (badgeLabels.length === 0) return { sent: false as const }

  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping badge-earned email.')
    return { sent: false as const }
  }

  const admin = createAdminClient()
  const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
  const email = userData.user?.email
  if (!email) return { sent: false as const }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const statsUrl = `${appUrl}/dashboard/stats`
  const unsubscribeUrl = `${appUrl}/api/unsubscribe/${candidate.id}?type=weekly`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: email,
    subject: badgeLabels.length === 1 ? `You just earned "${badgeLabels[0]}"` : 'You just earned new badges',
    react: BadgeEarnedEmail({
      firstName: candidate.firstName,
      badgeLabels,
      statsUrl,
      unsubscribeUrl,
    }),
  })

  if (error) {
    console.error('Failed to send badge-earned email:', error)
    return { sent: false as const }
  }

  return { sent: true as const }
}
