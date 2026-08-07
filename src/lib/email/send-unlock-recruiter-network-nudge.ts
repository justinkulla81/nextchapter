import 'server-only'
import { Resend } from 'resend'
import UnlockRecruiterNetworkNudgeEmail from '@/emails/unlock-recruiter-network-nudge'

export async function sendUnlockRecruiterNetworkNudgeEmail(candidate: {
  id: string
  firstName: string | null
  email: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping unlock-recruiter-network nudge email.')
    return { sent: false as const }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const privacyUrl = `${appUrl}/dashboard/privacy`
  const unsubscribeUrl = `${appUrl}/api/unsubscribe/${candidate.id}?type=recruiterUnlockNudge`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: candidate.email,
      subject: "You're A-grade — unlock the Recruiter Database?",
      react: UnlockRecruiterNetworkNudgeEmail({ firstName: candidate.firstName, privacyUrl, unsubscribeUrl }),
    })

    if (error) {
      console.error('Failed to send unlock-recruiter-network nudge email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send unlock-recruiter-network nudge email:', error)
    return { sent: false as const }
  }
}
