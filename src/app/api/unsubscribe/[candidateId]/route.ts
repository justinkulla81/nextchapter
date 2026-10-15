import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { verifyLink } from '@/lib/email/signed-links'
import { confirmPage, messagePage } from '@/lib/http/confirm-page'

// Unsigned links were sent before links carried a signature; they are honoured
// until this date so an unsubscribe in an old email still works.
const LEGACY_UNSIGNED_UNTIL = Date.parse('2027-04-13T00:00:00Z')

const FIELD_BY_TYPE: Record<string, Record<string, boolean>> = {
  daily: { dailyEmailOptedOut: true },
  jobSearchDaily: { jobSearchDailyOptedOut: true },
  freshJobAlerts: { freshJobAlertsOptedOut: true },
  weekly: { weeklyReportOptedOut: true },
  sprintGoal: { sprintGoalEmailsOptedOut: true },
  recruiterUnlockNudge: { recruiterUnlockNudgeOptedOut: true },
}
const DEFAULT_DATA = { reminderEmailsOptedOut: true }

const MESSAGE_BY_TYPE: Record<string, string> = {
  daily: "You won't receive any more daily action emails from Vic.",
  jobSearchDaily: "You won't receive Job Search Daily anymore. Your other NextChapter emails are unchanged.",
  freshJobAlerts: "You won't receive new-job alerts anymore. Your other NextChapter emails are unchanged.",
  weekly: "You won't receive the Friday check-in, Community & Coaching digest, or backchannel-connection emails anymore.",
  sprintGoal: "You won't receive any more Weekly Search Sprint goal-setting reminders.",
}
const DEFAULT_MESSAGE = "You won't receive any more reminder emails from NextChapter about finishing your account."

function authorize(request: NextRequest, candidateId: string, type: string | null): boolean {
  const sig = request.nextUrl.searchParams.get('sig')
  if (sig) return verifyLink(sig, 'unsub-candidate', candidateId, type ?? '')
  return Date.now() < LEGACY_UNSIGNED_UNTIL
}

// GET only shows a confirmation button: mail scanners fetch every link in a
// message, and an unsubscribe that fires on GET opts people out unasked.
export async function GET(request: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params
  const type = request.nextUrl.searchParams.get('type')
  if (!authorize(request, candidateId, type)) {
    return messagePage('This unsubscribe link is no longer valid. You can manage your email preferences from your NextChapter account settings.', 410)
  }
  return confirmPage({
    message: 'Unsubscribe from these NextChapter emails?',
    button: 'Confirm unsubscribe',
    action: `${request.nextUrl.pathname}${request.nextUrl.search}`,
  })
}

// POST performs the opt-out. It is also the target of mail clients'
// RFC 8058 one-click unsubscribe.
export async function POST(request: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params
  const type = request.nextUrl.searchParams.get('type')
  if (!authorize(request, candidateId, type)) {
    return messagePage('This unsubscribe link is no longer valid. You can manage your email preferences from your NextChapter account settings.', 410)
  }

  // In-work review emails keep their own opt-out on InWorkProfile.
  if (type === 'inWork') {
    await prisma.inWorkProfile
      .upsert({ where: { candidateId }, create: { candidateId, promptsEnabled: false }, update: { promptsEnabled: false } })
      .catch(() => {})
    captureServerEvent(candidateId, 'in_work_review_emails_unsubscribed', {})
    return messagePage(
      "You won't receive review reminders anymore. Your other NextChapter emails are unchanged. You can turn them back on in your workspace.",
    )
  }

  const data = (type && FIELD_BY_TYPE[type]) || DEFAULT_DATA
  await prisma.candidateProfile.update({ where: { id: candidateId }, data }).catch(() => {
    // Unknown/already-deleted candidate — nothing to do, still show the
    // same confirmation so this link never errors visibly for a recipient.
  })

  if (type === 'jobSearchDaily') captureServerEvent(candidateId, 'job_search_daily_unsubscribed', {})
  if (type === 'freshJobAlerts') captureServerEvent(candidateId, 'fresh_job_alerts_unsubscribed', {})

  return messagePage((type && MESSAGE_BY_TYPE[type]) || DEFAULT_MESSAGE)
}
