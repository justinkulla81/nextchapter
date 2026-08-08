import 'server-only'
import { Resend } from 'resend'
import PortfolioAccessRequestEmail from '@/emails/portfolio-access-request'

export async function sendPortfolioAccessRequestEmail(
  candidateEmail: string,
  firstName: string | null,
  recruiterName: string,
  recruiterFirm: string | null
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping portfolio access request email.')
    return { sent: false as const }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: candidateEmail,
      subject: `${recruiterName} wants to see your Portfolio`,
      react: PortfolioAccessRequestEmail({ firstName, recruiterName, recruiterFirm }),
    })

    if (error) {
      console.error('Failed to send portfolio access request email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    // Email delivery must never break the request-access action.
    console.error('Failed to send portfolio access request email:', error)
    return { sent: false as const }
  }
}
