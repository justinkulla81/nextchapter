import 'server-only'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import WeeklyGapNudgeEmail from '@/emails/weekly-gap-nudge'

export async function sendWeeklyGapNudgeEmail(
  candidate: { id: string; userId: string; firstName: string | null },
  weeklyPoints: number,
  weeklyPointsTarget: number
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping weekly gap nudge email.')
    return { sent: false as const }
  }

  const admin = createAdminClient()
  const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
  const email = userData.user?.email
  if (!email) return { sent: false as const }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const dashboardUrl = `${appUrl}/dashboard`
  const unsubscribeUrl = `${appUrl}/api/unsubscribe/${candidate.id}?type=weekly`

  const pointsToGo = Math.max(0, weeklyPointsTarget - weeklyPoints)

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: email,
    subject: candidate.firstName
      ? `${pointsToGo} points from an A this week, ${candidate.firstName}`
      : `${pointsToGo} points from an A this week`,
    react: WeeklyGapNudgeEmail({
      firstName: candidate.firstName,
      weeklyPoints,
      weeklyPointsTarget,
      dashboardUrl,
      unsubscribeUrl,
    }),
  })

  if (error) {
    console.error('Failed to send weekly gap nudge email:', error)
    return { sent: false as const }
  }

  return { sent: true as const }
}
