import 'server-only'
import { Resend } from 'resend'
import AdminResumeUploadedEmail from '@/emails/admin-resume-uploaded'

export async function sendAdminResumeUploadedEmail(
  adminEmail: string,
  candidateId: string,
  candidateName: string,
  fileName: string
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping admin resume-uploaded email.')
    return { sent: false as const }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const adminUrl = `${appUrl}/support/admin/candidates/${candidateId}`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: adminEmail,
      subject: `Resume uploaded: ${candidateName}`,
      react: AdminResumeUploadedEmail({ candidateName, fileName, adminUrl }),
    })

    if (error) {
      console.error('Failed to send admin resume-uploaded email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send admin resume-uploaded email:', error)
    return { sent: false as const }
  }
}
