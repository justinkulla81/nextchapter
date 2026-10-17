import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendScamAlertEmail } from '@/lib/email/send-scam-alert'
import type { ScamAssessment } from './assess-recruiter-email'

// Mail older than this is recorded but never emailed about: a first-time
// sync backfills ~90 days, and a "don't book that call" email about a message
// from two months ago is noise, not rescue.
const EMAIL_FRESHNESS_MS = 3 * 24 * 60 * 60 * 1000

export async function raiseScamAlert(args: {
  candidateId: string
  connectionId: string
  messageId: string
  threadId: string | null
  from: string
  subject: string
  emailDate: Date
  assessment: ScamAssessment
}): Promise<void> {
  const { assessment } = args
  if (assessment.level === 'none') return
  const level = assessment.level === 'likely_fake' ? 'LIKELY_FAKE' : 'SUSPICIOUS'

  let alertId: string
  try {
    const created = await prisma.scamAlert.create({
      data: {
        candidateId: args.candidateId,
        connectionId: args.connectionId,
        externalMessageId: args.messageId,
        threadId: args.threadId,
        level,
        score: assessment.score,
        claimedCompany: assessment.claimedCompany,
        fromAddress: args.from.slice(0, 300),
        subject: args.subject.slice(0, 300),
        flaggedDomains: assessment.flaggedDomains,
        signals: assessment.signals as unknown as Prisma.InputJsonValue,
        emailDate: args.emailDate,
      },
      select: { id: true },
    })
    alertId = created.id
  } catch (error) {
    // Already recorded (a re-sync of the same message) — nothing to redo.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return
    throw error
  }

  captureServerEvent(args.candidateId, 'scam_alert_detected', {
    alertId,
    level,
    score: assessment.score,
    claimedCompany: assessment.claimedCompany,
    signalCodes: assessment.signals.map((s) => s.code),
    flaggedDomains: assessment.flaggedDomains,
  })

  if (Date.now() - args.emailDate.getTime() > EMAIL_FRESHNESS_MS) return

  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: args.candidateId },
    select: { id: true, userId: true, firstName: true },
  })
  if (!candidate) return

  const { sent } = await sendScamAlertEmail(candidate, {
    level,
    claimedCompany: assessment.claimedCompany,
    fromAddress: args.from,
    subject: args.subject,
    reasons: assessment.signals.slice(0, 4).map((s) => s.detail),
  })
  if (!sent) return

  await prisma.scamAlert.update({ where: { id: alertId }, data: { alertEmailSentAt: new Date() } })
  captureServerEvent(args.candidateId, 'scam_alert_email_sent', { alertId, level, claimedCompany: assessment.claimedCompany })
}
