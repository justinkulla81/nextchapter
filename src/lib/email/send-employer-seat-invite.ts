import 'server-only'
import { Resend } from 'resend'
import EmployerSeatInviteEmail from '@/emails/employer-seat-invite'

export async function sendEmployerSeatInviteEmail(
  invitedEmail: string,
  companyName: string,
  inviterName: string | null,
  acceptUrl: string
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping seat invite email.')
    return { sent: false as const }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: invitedEmail,
      subject: `You're invited to join ${companyName} on NextChapter`,
      react: EmployerSeatInviteEmail({ companyName, inviterName, acceptUrl }),
    })

    if (error) {
      console.error('Failed to send employer seat invite email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send employer seat invite email:', error)
    return { sent: false as const }
  }
}
