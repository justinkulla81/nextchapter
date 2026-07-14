import 'server-only'
import { Resend } from 'resend'
import ReferenceRequestEmail from '@/emails/reference-request'

export async function sendReferenceRequestEmail({
  refereeEmail,
  refereeName,
  candidateName,
  token,
}: {
  refereeEmail: string
  refereeName: string
  candidateName: string
  token: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping reference request email.')
    return { sent: false as const }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const referenceUrl = `${appUrl}/ref/${token}`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: refereeEmail,
      subject: `${candidateName} has requested a reference from you`,
      react: ReferenceRequestEmail({ candidateName, refereeName, referenceUrl }),
    })

    if (error) {
      console.error('Failed to send reference request email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    // Email delivery must never break reference request creation.
    console.error('Failed to send reference request email:', error)
    return { sent: false as const }
  }
}
