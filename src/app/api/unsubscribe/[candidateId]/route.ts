import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { verifyLink } from '@/lib/email/signed-links'
import { choicePage, confirmPage, messagePage } from '@/lib/http/confirm-page'

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
// The recurring streams where "send me fewer" makes sense.
const RECURRING_TYPES = new Set(['daily', 'weekly', 'jobSearchDaily'])

const MESSAGE_BY_TYPE: Record<string, string> = {
  daily: "You won't receive the Thursday check-in or the Sunday week-in-review anymore. Your other NextChapter emails are unchanged.",
  jobSearchDaily: "You won't receive Job Search Daily anymore. Your other NextChapter emails are unchanged.",
  freshJobAlerts: "You won't receive new-job alerts anymore. Your other NextChapter emails are unchanged.",
  weekly: "You won't receive the Monday plan, \"a way in\" connection emails, or check-ins when you have been away anymore. Your other NextChapter emails are unchanged.",
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
  // Someone on the full schedule who clicks unsubscribe is often saying "too many",
  // not "none". Offer the lighter schedule first, with the unsubscribe one click
  // away. Nothing changes on GET.
  if (type && RECURRING_TYPES.has(type)) {
    const member = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { notificationTier: true } }).catch(() => null)
    if (member?.notificationTier === 'FULL') {
      const base = `${request.nextUrl.pathname}${request.nextUrl.search}`
      return choicePage({
        message: 'Getting too many emails? You can get fewer instead of none: a short plan on Monday and a check-in on Thursday, plus anything urgent.',
        primary: { label: 'Send me fewer emails', action: `${base}&fewer=1` },
        secondary: { label: 'Unsubscribe from these emails', action: base },
        footer: { label: 'Choose exactly which emails you get', href: `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/dashboard/privacy` },
      })
    }
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

  // "Send me fewer": the lighter schedule instead of an opt-out.
  if (request.nextUrl.searchParams.get('fewer') === '1') {
    await prisma.candidateProfile
      .updateMany({ where: { id: candidateId, notificationTier: 'FULL' }, data: { notificationTier: 'ESSENTIALS' } })
      .catch(() => {})
    captureServerEvent(candidateId, 'email_send_fewer_chosen', { type })
    return messagePage("Done. You'll get your plan on Monday and a check-in on Thursday, plus anything urgent. You can change this anytime in your NextChapter settings.")
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
