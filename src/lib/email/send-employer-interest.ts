import 'server-only'
import { Resend } from 'resend'
import EmployerInterestEmail from '@/emails/employer-interest'

export async function sendEmployerInterestEmail(
  candidateEmail: string,
  firstName: string | null,
  companyName: string
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping employer interest email.')
    return { sent: false as const }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: candidateEmail,
      subject: `${companyName} is interested in your profile`,
      react: EmployerInterestEmail({ firstName, companyName }),
    })

    if (error) {
      console.error('Failed to send employer interest email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    // Email delivery must never break the express-interest action.
    console.error('Failed to send employer interest email:', error)
    return { sent: false as const }
  }
}
