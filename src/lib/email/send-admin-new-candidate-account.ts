import 'server-only'
import { Resend } from 'resend'
import AdminNewCandidateAccountEmail from '@/emails/admin-new-candidate-account'

export async function sendAdminNewCandidateAccountEmail(
  adminEmail: string,
  candidateId: string,
  candidateName: string,
  signupIp: string | null
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping admin new-candidate-account email.')
    return { sent: false as const }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const adminUrl = `${appUrl}/support/admin/candidates/${candidateId}`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: adminEmail,
      subject: `New candidate account: ${candidateName}`,
      react: AdminNewCandidateAccountEmail({ candidateName, signupIp, adminUrl }),
    })

    if (error) {
      console.error('Failed to send admin new-candidate-account email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send admin new-candidate-account email:', error)
    return { sent: false as const }
  }
}
