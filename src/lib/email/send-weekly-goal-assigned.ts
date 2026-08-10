import 'server-only'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import WeeklyGoalAssignedEmail from '@/emails/weekly-goal-assigned'
import { CATEGORY_MINIMUM_ENFORCED_FROM_WEEK, WEEKLY_ENGINE_LABEL } from '@/lib/scoring/grade'
import type { Grade, WeeklyEngine } from '@/lib/scoring/grade'
import { recordCandidateEmailSent } from '@/lib/email/send-log'

// What's blocking an A, in the same terms as UnlockAListCallout on the
// dashboard — kept in sync deliberately, since this is the email version of
// that same message rather than a separate one invented for here.
function buildGapSummary(
  grade: Grade,
  weeklySprintsCount: number,
  laggingEngines: WeeklyEngine['key'][]
): string | null {
  if (grade === 'A') return null
  if (weeklySprintsCount < CATEGORY_MINIMUM_ENFORCED_FROM_WEEK) {
    return 'Keep building across all four weekly areas — Learning, Effort, Working, and Connecting — to raise your grade.'
  }
  if (laggingEngines.length > 0) {
    const labels = laggingEngines.map((key) => WEEKLY_ENGINE_LABEL[key]).join(', ')
    return `Real work is still needed in: ${labels}. Your grade is capped at B until every engine clears the bar.`
  }
  return "You're covering all four weekly areas — keep it up and your grade will catch up."
}

export async function sendWeeklyGoalAssignedEmail(
  candidate: { id: string; userId: string; firstName: string | null },
  params: {
    lastWeekPoints: number
    lastWeekTarget: number
    thisWeekTarget: number
    grade: Grade
    weeklySprintsCount: number
    laggingEngines: WeeklyEngine['key'][]
  },
  introCopy?: string | null
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping weekly goal-assigned email.')
    return { sent: false as const }
  }

  const admin = createAdminClient()
  const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
  const email = userData.user?.email
  if (!email) return { sent: false as const }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const dashboardUrl = `${appUrl}/dashboard`
  const unsubscribeUrl = `${appUrl}/api/unsubscribe/${candidate.id}?type=weekly`

  const { lastWeekPoints, lastWeekTarget, thisWeekTarget, grade, weeklySprintsCount, laggingEngines } = params
  const hitLastWeekTarget = lastWeekPoints >= lastWeekTarget
  const targetDelta = thisWeekTarget - lastWeekTarget
  const gapSummary = buildGapSummary(grade, weeklySprintsCount, laggingEngines)

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: email,
    subject: candidate.firstName ? `Your new week is set, ${candidate.firstName}` : 'Your new week is set',
    react: WeeklyGoalAssignedEmail({
      firstName: candidate.firstName,
      introCopy: introCopy ?? null,
      lastWeekPoints,
      lastWeekTarget,
      hitLastWeekTarget,
      thisWeekTarget,
      targetDelta,
      grade,
      gapSummary,
      dashboardUrl,
      unsubscribeUrl,
    }),
  })

  if (error) {
    console.error('Failed to send weekly goal-assigned email:', error)
    return { sent: false as const }
  }

  await recordCandidateEmailSent(candidate.id, 'MORNING_MOTIVATION')

  return { sent: true as const }
}
