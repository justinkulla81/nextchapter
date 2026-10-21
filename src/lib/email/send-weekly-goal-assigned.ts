import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTodaysPrimaryAction } from '@/lib/daily/primary-action'
import { buildEmailClickUrl } from '@/lib/email/click-link'
import WeeklyGoalAssignedEmail from '@/emails/weekly-goal-assigned'
import { getEngagementLead } from '@/lib/journey/engagement-data'
import { captureServerEvent } from '@/lib/posthog/server'
import { CATEGORY_MINIMUM_ENFORCED_FROM_WEEK, WEEKLY_ENGINE_LABEL } from '@/lib/scoring/grade'
import type { Grade, WeeklyEngine } from '@/lib/scoring/grade'
import { recordCandidateEmailSent, trackEmailSent } from '@/lib/email/send-log'
import { candidateUnsubscribeUrl } from '@/lib/email/signed-links'

// What's blocking an A, in the same terms as UnlockCandidatePlusCallout on
// the dashboard — kept in sync deliberately, since this is the email version
// of that same message rather than a separate one invented for here.
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
    completedLastWeek: string[]
    thisWeekPlan: string[]
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
  const engagement = await getEngagementLead(candidate.id).catch(() => null)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const dashboardUrl = buildEmailClickUrl(appUrl, candidate.id, 'MORNING_MOTIVATION', `${appUrl}/dashboard`)
  const marketRealityReportUrl = buildEmailClickUrl(appUrl, candidate.id, 'MORNING_MOTIVATION', `${appUrl}/dashboard/market-reality`)
  const unsubscribeUrl = candidateUnsubscribeUrl(appUrl, candidate.id, 'weekly')

  const {
    lastWeekPoints,
    lastWeekTarget,
    thisWeekTarget,
    grade,
    weeklySprintsCount,
    laggingEngines,
    completedLastWeek,
    thisWeekPlan,
  } = params
  const hitLastWeekTarget = lastWeekPoints >= lastWeekTarget
  const targetDelta = thisWeekTarget - lastWeekTarget
  const gapSummary = buildGapSummary(grade, weeklySprintsCount, laggingEngines)

  // The one concrete thing to start with: the retired Wednesday "one thing for
  // today" nudge, folded into this email.
  const report = await prisma.marketRealityReport.findFirst({ where: { candidateId: candidate.id }, orderBy: { generatedAt: 'desc' } }).catch(() => null)
  const firstStep = report
    ? (getTodaysPrimaryAction(report.actionPlan as unknown as Parameters<typeof getTodaysPrimaryAction>[0], report.generatedAt)?.text ?? null)
    : null

  const resend = createResend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: email,
    subject: candidate.firstName ? `Your new week is set, ${candidate.firstName}` : 'Your new week is set',
    react: WeeklyGoalAssignedEmail({
      firstName: candidate.firstName,
      introCopy: introCopy ?? null,
      engagement,
      appUrl,
      lastWeekPoints,
      lastWeekTarget,
      hitLastWeekTarget,
      thisWeekTarget,
      targetDelta,
      grade,
      gapSummary,
      completedLastWeek,
      thisWeekPlan,
      firstStep,
      dashboardUrl,
      marketRealityReportUrl,
      unsubscribeUrl,
    }),
  })

  if (error) {
    console.error('Failed to send weekly goal-assigned email:', error)
    return { sent: false as const }
  }

  await recordCandidateEmailSent(candidate.id, 'MORNING_MOTIVATION')
  trackEmailSent(candidate.id, 'MORNING_MOTIVATION')
  if (engagement) {
    captureServerEvent(candidate.id, 'engagement_lead_emailed', {
      email: 'MORNING_MOTIVATION',
      level: engagement.level,
      steps: engagement.steps.map((x) => x.key),
      gate: engagement.gate?.headline ?? null,
    })
  }

  return { sent: true as const }
}
