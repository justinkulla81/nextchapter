import 'server-only'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import BackchannelMatchEmail from '@/emails/backchannel-match'

export async function sendBackchannelMatchEmail(
  candidate: { id: string; userId: string; firstName: string | null },
  companyName: string,
  contactNames: string[]
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping backchannel match email.')
    return { sent: false as const }
  }

  const admin = createAdminClient()
  const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
  const email = userData.user?.email
  if (!email) return { sent: false as const }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const networkUrl = `${appUrl}/dashboard/network`
  const unsubscribeUrl = `${appUrl}/api/unsubscribe/${candidate.id}?type=weekly`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: email,
    subject: `You know someone at ${companyName}`,
    react: BackchannelMatchEmail({
      firstName: candidate.firstName,
      companyName,
      contactNames,
      networkUrl,
      unsubscribeUrl,
    }),
  })

  if (error) {
    console.error('Failed to send backchannel match email:', error)
    return { sent: false as const }
  }

  return { sent: true as const }
}
