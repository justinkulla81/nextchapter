import 'server-only'
import { Resend } from 'resend'
import BenefitsNetworkVerifyEmail from '@/emails/benefits-network-verify'

export async function sendBenefitsNetworkVerifyEmail({
  institutionEmail,
  alumName,
  institutionName,
  programName,
  confirmUrl,
}: {
  institutionEmail: string
  alumName: string
  institutionName: string
  programName: string
  confirmUrl: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping Benefits Network verification email.')
    return { sent: false as const }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: institutionEmail,
      subject: `Confirm ${institutionName}'s offer on NextChapter's Alumni Benefits Network`,
      react: BenefitsNetworkVerifyEmail({ alumName, institutionName, programName, confirmUrl }),
    })

    if (error) {
      console.error('Failed to send Benefits Network verification email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send Benefits Network verification email:', error)
    return { sent: false as const }
  }
}
