import 'server-only'
import { Resend } from 'resend'
import CoachClientInviteEmail from '@/emails/coach-client-invite'

export async function sendCoachClientInviteEmail(
  invitedEmail: string,
  coachName: string,
  firmName: string | null,
  acceptUrl: string
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping coach client invite email.')
    return { sent: false as const }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: invitedEmail,
      subject: `${coachName} invited you to NextChapter`,
      react: CoachClientInviteEmail({ coachName, firmName, acceptUrl }),
    })

    if (error) {
      console.error('Failed to send coach client invite email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send coach client invite email:', error)
    return { sent: false as const }
  }
}
