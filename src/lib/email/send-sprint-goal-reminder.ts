import 'server-only'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import SprintGoalReminderEmail, { type SprintGoalReminderVariant } from '@/emails/sprint-goal-reminder'

export async function sendSprintGoalReminderEmail(
  candidate: { id: string; userId: string; firstName: string | null },
  variant: SprintGoalReminderVariant,
  pointsTarget: number
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping sprint goal reminder email.')
    return { sent: false as const }
  }

  const admin = createAdminClient()
  const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
  const email = userData.user?.email
  if (!email) return { sent: false as const }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const dashboardUrl = `${appUrl}/dashboard`
  const unsubscribeUrl = `${appUrl}/api/unsubscribe/${candidate.id}?type=sprintGoal`

  const subjects: Record<SprintGoalReminderVariant, string> = {
    open: candidate.firstName
      ? `Set your Search Actions for this week, ${candidate.firstName}`
      : 'Set your Search Actions for this week',
    reminder: "You haven't set this week's Search Actions yet",
    final: 'Your Search Actions lock in about an hour',
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: email,
    subject: subjects[variant],
    react: SprintGoalReminderEmail({
      firstName: candidate.firstName,
      pointsTarget,
      variant,
      dashboardUrl,
      unsubscribeUrl,
    }),
  })

  if (error) {
    console.error(`Failed to send sprint goal ${variant} email:`, error)
    return { sent: false as const }
  }

  return { sent: true as const }
}
