import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import MembershipNoticeEmail from '@/emails/membership-notice'

export async function sendMembershipNoticeEmail({
  to,
  subject,
  heading,
  bodyLines,
  ctaLabel,
  ctaUrl,
}: {
  to: string
  subject: string
  heading: string
  bodyLines: string[]
  ctaLabel: string
  ctaUrl: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping membership notice email.')
    return { sent: false as const }
  }

  try {
    const resend = createResend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to,
      subject,
      react: MembershipNoticeEmail({ heading, bodyLines, ctaLabel, ctaUrl }),
    })

    if (error) {
      console.error('Failed to send membership notice email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send membership notice email:', error)
    return { sent: false as const }
  }
}
