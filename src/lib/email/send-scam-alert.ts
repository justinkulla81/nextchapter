import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { createAdminClient } from '@/lib/supabase/admin'
import ScamAlertEmail from '@/emails/scam-alert'
import { getVictoriaName } from '@/lib/victoria'
import { signLink } from '@/lib/email/signed-links'

// Replies land in Vic's own inbox (an alias that forwards to Justin) so a
// "this is real" answer from a candidate is read by a person.
export const VIC_ADDRESS = 'vic@launchyournextchapter.com'

// Rapid-response safety email — sent within minutes of detection, not queued
// into a digest, and deliberately NOT gated by the candidate's notification
// tier or an unsubscribe stream: a candidate on the minimal tier still needs
// to hear "don't book that call." The way to stop these is to disconnect Gmail.
export async function sendScamAlertEmail(
  candidate: { id: string; userId: string; firstName: string | null },
  alert: {
    alertId: string
    level: 'LIKELY_FAKE' | 'SUSPICIOUS'
    claimedCompany: string | null
    fromAddress: string
    subject: string
    reasons: string[]
  },
): Promise<{ sent: boolean }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping scam alert email.')
    return { sent: false }
  }

  const admin = createAdminClient()
  const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
  const email = userData.user?.email
  if (!email) return { sent: false }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const victoriaName = getVictoriaName('daily-email')
  const about = alert.claimedCompany ? `the ${alert.claimedCompany} email` : 'a recruiter email'

  const resend = createResend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: `${victoriaName} at NextChapter <${VIC_ADDRESS}>`,
    replyTo: VIC_ADDRESS,
    to: email,
    subject:
      alert.level === 'LIKELY_FAKE'
        ? `${victoriaName}: don't book anything yet, ${about} may be fake`
        : `${victoriaName}: pause before you reply, ${about} looks off`,
    react: ScamAlertEmail({
      firstName: candidate.firstName,
      victoriaName,
      level: alert.level,
      claimedCompany: alert.claimedCompany,
      fromAddress: alert.fromAddress,
      subjectLine: alert.subject,
      reasons: alert.reasons,
      alertUrl: `${appUrl}/dashboard/scam-watch`,
      notSpamUrl: `${appUrl}/api/scam-alert/${alert.alertId}/not-spam?sig=${signLink('scam-not-spam', alert.alertId)}`,
      settingsUrl: `${appUrl}/dashboard/privacy`,
    }),
  })

  if (error) {
    console.error('Failed to send scam alert email:', error)
    return { sent: false }
  }
  return { sent: true }
}
