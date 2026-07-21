import 'server-only'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import InterimRoleCheckInEmail from '@/emails/interim-role-check-in'

export async function sendInterimRoleCheckInEmail(
  candidate: { id: string; userId: string; firstName: string | null },
  entry: { id: string; companyName: string }
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping interim role check-in email.')
    return { sent: false as const }
  }

  const admin = createAdminClient()
  const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
  const email = userData.user?.email
  if (!email) return { sent: false as const }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const stillActiveUrl = `${appUrl}/api/interim-check-in/${entry.id}?response=active`
  const endedUrl = `${appUrl}/api/interim-check-in/${entry.id}?response=ended`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: email,
    subject: entry.companyName
      ? `Still doing your interim work at ${entry.companyName}?`
      : 'Still doing your interim work?',
    react: InterimRoleCheckInEmail({
      firstName: candidate.firstName,
      companyName: entry.companyName,
      stillActiveUrl,
      endedUrl,
    }),
  })

  if (error) {
    console.error('Failed to send interim role check-in email:', error)
    return { sent: false as const }
  }

  return { sent: true as const }
}
