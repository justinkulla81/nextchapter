import 'server-only'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import CommunityCoachingDigestEmail from '@/emails/community-coaching-digest'

export async function sendCommunityCoachingDigestEmail(
  candidate: { id: string; userId: string; firstName: string | null },
  encouragementCount: number,
  hadCoachSession: boolean
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping community & coaching digest email.')
    return { sent: false as const }
  }

  const admin = createAdminClient()
  const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
  const email = userData.user?.email
  if (!email) return { sent: false as const }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const dashboardUrl = `${appUrl}/dashboard`
  const unsubscribeUrl = `${appUrl}/api/unsubscribe/${candidate.id}?type=weekly`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: email,
    subject: candidate.firstName ? `Your week in review, ${candidate.firstName}` : 'Your week in review',
    react: CommunityCoachingDigestEmail({
      firstName: candidate.firstName,
      encouragementCount,
      hadCoachSession,
      dashboardUrl,
      unsubscribeUrl,
    }),
  })

  if (error) {
    console.error('Failed to send community & coaching digest email:', error)
    return { sent: false as const }
  }

  return { sent: true as const }
}
