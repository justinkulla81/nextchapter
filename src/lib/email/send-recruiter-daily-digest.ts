import 'server-only'
import { Resend } from 'resend'
import RecruiterDailyDigestEmail from '@/emails/recruiter-daily-digest'

export async function sendRecruiterDailyDigestEmail(
  recruiter: { id: string; fullName: string; workEmail: string },
  candidates: { primaryFunction: string; level: string; targetRoleType: string; industry: string; geo: string }[]
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping recruiter daily digest email.')
    return { sent: false as const }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const portalUrl = `${appUrl}/recruiters/search`
  const unsubscribeUrl = `${appUrl}/api/unsubscribe/audience/recruiter/${recruiter.id}?type=candidate-alert`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: recruiter.workEmail,
      subject:
        candidates.length === 1
          ? 'A new A-grade candidate just unlocked'
          : `${candidates.length} new A-grade candidates just unlocked`,
      react: RecruiterDailyDigestEmail({
        fullName: recruiter.fullName,
        candidates,
        portalUrl,
        unsubscribeUrl,
      }),
    })

    if (error) {
      console.error('Failed to send recruiter daily digest email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send recruiter daily digest email:', error)
    return { sent: false as const }
  }
}
