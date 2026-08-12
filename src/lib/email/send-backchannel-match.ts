import 'server-only'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import BackchannelMatchEmail from '@/emails/backchannel-match'

export async function sendBackchannelMatchEmail(
  candidate: { id: string; userId: string; firstName: string | null },
  companyName: string,
  contactNames: string[],
  otherCompanyCount: number
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
  // #jobs-applied is the Application Tracker section's scroll anchor on
  // Find Full-Time Jobs (see find-my-job/page.tsx) — takes the candidate
  // straight to their applications instead of the top of the Network page.
  const applicationTrackerUrl = `${appUrl}/dashboard/find-my-job#jobs-applied`
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
      otherCompanyCount,
      applicationTrackerUrl,
      unsubscribeUrl,
    }),
  })

  if (error) {
    console.error('Failed to send backchannel match email:', error)
    return { sent: false as const }
  }

  return { sent: true as const }
}
