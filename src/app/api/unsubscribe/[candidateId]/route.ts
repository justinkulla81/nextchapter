import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  const { candidateId } = await params
  const type = request.nextUrl.searchParams.get('type')

  const data =
    type === 'daily'
      ? { dailyEmailOptedOut: true }
      : type === 'jobSearchDaily'
        ? { jobSearchDailyOptedOut: true }
        : type === 'freshJobAlerts'
        ? { freshJobAlertsOptedOut: true }
        : type === 'weekly'
        ? { weeklyReportOptedOut: true }
        : type === 'sprintGoal'
          ? { sprintGoalEmailsOptedOut: true }
          : type === 'recruiterUnlockNudge'
            ? { recruiterUnlockNudgeOptedOut: true }
            : { reminderEmailsOptedOut: true }

  await prisma.candidateProfile.update({ where: { id: candidateId }, data }).catch(() => {
    // Unknown/already-deleted candidate — nothing to do, still show the
    // same confirmation so this link never errors visibly for a recipient.
  })

  if (type === 'jobSearchDaily') captureServerEvent(candidateId, 'job_search_daily_unsubscribed', {})
  if (type === 'freshJobAlerts') captureServerEvent(candidateId, 'fresh_job_alerts_unsubscribed', {})

  const message =
    type === 'daily'
      ? "You won't receive any more daily action emails from Vic."
      : type === 'jobSearchDaily'
        ? "You won't receive Job Search Daily anymore. Your other NextChapter emails are unchanged."
        : type === 'freshJobAlerts'
        ? "You won't receive new-job alerts anymore. Your other NextChapter emails are unchanged."
        : type === 'weekly'
        ? "You won't receive the Friday check-in, Community & Coaching digest, or backchannel-connection emails anymore."
        : type === 'sprintGoal'
          ? "You won't receive any more Weekly Search Sprint goal-setting reminders."
          : "You won't receive any more reminder emails from NextChapter about finishing your account."

  return new NextResponse(
    `<!doctype html><html><body style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 64px auto; padding: 0 24px; color: #111;"><p>${message}</p></body></html>`,
    { headers: { 'content-type': 'text/html' } }
  )
}
