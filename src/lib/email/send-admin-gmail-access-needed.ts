import 'server-only'
import { Resend } from 'resend'
import AdminGmailAccessNeededEmail from '@/emails/admin-gmail-access-needed'

export async function sendAdminGmailAccessNeededEmail(
  adminEmail: string,
  candidateId: string,
  candidateName: string,
  candidateEmail: string,
  googleConsoleUrl: string
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping admin gmail-access-needed email.')
    return { sent: false as const }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const adminUrl = `${appUrl}/support/admin/candidates/${candidateId}`
  const allowlistUrl = `${appUrl}/support/admin/tracking-testers?q=${encodeURIComponent(candidateEmail)}`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: adminEmail,
      subject: `Gmail access needed: ${candidateName}`,
      react: AdminGmailAccessNeededEmail({ candidateName, candidateEmail, adminUrl, googleConsoleUrl, allowlistUrl }),
    })

    if (error) {
      console.error('Failed to send admin gmail-access-needed email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send admin gmail-access-needed email:', error)
    return { sent: false as const }
  }
}
