import 'server-only'
import { Resend } from 'resend'
import AdminRecruiterDigestEmail from '@/emails/admin-recruiter-digest'

export async function sendAdminRecruiterDigestEmail(
  adminEmail: string,
  candidates: {
    name: string
    email: string
    primaryFunction: string
    level: string
    targetRoleType: string
    industry: string
    geo: string
  }[],
  recruiterCount: number
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping admin recruiter digest email.')
    return { sent: false as const }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const adminUrl = `${appUrl}/support/admin/recruiter-database`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: adminEmail,
      subject: `Recruiter database: ${candidates.length} unlock${candidates.length === 1 ? '' : 's'} today`,
      react: AdminRecruiterDigestEmail({ candidates, recruiterCount, adminUrl }),
    })

    if (error) {
      console.error('Failed to send admin recruiter digest email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send admin recruiter digest email:', error)
    return { sent: false as const }
  }
}
