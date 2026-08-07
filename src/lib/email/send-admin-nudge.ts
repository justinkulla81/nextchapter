import 'server-only'
import { Resend } from 'resend'
import AdminNudgeEmail from '@/emails/admin-nudge'

export async function sendAdminNudgeEmail(params: {
  to: string
  subject: string
  bodyText: string
  ctaLabel: string
  ctaUrl: string
}): Promise<{ sent: true } | { sent: false; error: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping admin nudge email.')
    return { sent: false, error: 'Email sending is not configured (missing RESEND_API_KEY).' }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: params.to,
    subject: params.subject,
    react: AdminNudgeEmail({ bodyText: params.bodyText, ctaLabel: params.ctaLabel, ctaUrl: params.ctaUrl }),
  })

  if (error) {
    console.error('Failed to send admin nudge email:', error)
    return { sent: false, error: error.message }
  }

  return { sent: true }
}
