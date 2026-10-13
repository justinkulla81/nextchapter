import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { createAdminClient } from '@/lib/supabase/admin'
import WeeklyGapNudgeEmail from '@/emails/weekly-gap-nudge'
import { recordCandidateEmailSent } from '@/lib/email/send-log'
import { getEngagementLead } from '@/lib/journey/engagement-data'
import { captureServerEvent } from '@/lib/posthog/server'

export async function sendWeeklyGapNudgeEmail(
  candidate: { id: string; userId: string; firstName: string | null },
  weeklyPoints: number,
  weeklyPointsTarget: number,
  introCopy?: string | null
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
  const engagement = await getEngagementLead(candidate.id).catch(() => null)

  const resend = createResend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: email,
    subject: candidate.firstName
      ? `${pointsToGo} points from an A this week, ${candidate.firstName}`
      : `${pointsToGo} points from an A this week`,
    react: WeeklyGapNudgeEmail({
      firstName: candidate.firstName,
      introCopy: introCopy ?? null,
      engagement,
      appUrl,
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

  await recordCandidateEmailSent(candidate.id, 'GAP_NUDGE')
  if (engagement) {
    captureServerEvent(candidate.id, 'engagement_lead_emailed', {
      email: 'GAP_NUDGE',
      level: engagement.level,
      steps: engagement.steps.map((x) => x.key),
      gate: engagement.gate?.headline ?? null,
    })
  }

  return { sent: true as const }
}
