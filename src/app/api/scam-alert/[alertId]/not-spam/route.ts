import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyLink } from '@/lib/email/signed-links'
import { captureServerEvent } from '@/lib/posthog/server'
import { confirmPage, messagePage } from '@/lib/http/confirm-page'

// The "Not spam" button in Vic's scam alert email. Signed, so it works from the
// inbox without a login. GET only asks for confirmation (mail scanners fetch
// every link in an email); POST records it.

const INVALID = "This link isn't valid anymore. You can review the flag from your NextChapter dashboard."

export async function GET(request: NextRequest, { params }: { params: Promise<{ alertId: string }> }) {
  const { alertId } = await params
  if (!verifyLink(request.nextUrl.searchParams.get('sig'), 'scam-not-spam', alertId)) return messagePage(INVALID, 410)
  return confirmPage({
    message: 'Tell Vic this email is not spam?',
    button: 'Yes, it is real',
    action: `${request.nextUrl.pathname}${request.nextUrl.search}`,
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ alertId: string }> }) {
  const { alertId } = await params
  if (!verifyLink(request.nextUrl.searchParams.get('sig'), 'scam-not-spam', alertId)) return messagePage(INVALID, 410)

  const alert = await prisma.scamAlert.findUnique({
    where: { id: alertId },
    select: { id: true, candidateId: true, level: true, score: true, claimedCompany: true, fromAddress: true, signals: true, markedLegitAt: true },
  })
  if (!alert) return messagePage("This link isn't valid.")

  if (!alert.markedLegitAt) {
    await prisma.scamAlert.update({ where: { id: alert.id }, data: { markedLegitAt: new Date() } })
    captureServerEvent(alert.candidateId, 'scam_alert_marked_legit', {
      alertId,
      source: 'email_button',
      level: alert.level,
      score: alert.score,
      claimedCompany: alert.claimedCompany,
      fromAddress: alert.fromAddress,
      signalCodes: Array.isArray(alert.signals) ? (alert.signals as { code?: string }[]).map((s) => s.code) : [],
    })
  }
  return messagePage("Thanks, I've marked it as not spam. That helps me get better. If you want to tell me more, just reply to my email.")
}
