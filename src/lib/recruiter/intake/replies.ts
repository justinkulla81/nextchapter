import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendIntakeReply } from '@/lib/email/send-intake'

// Sending approved replies needs BOTH a recruiter's approval and the global
// switch (RecruiterSettings.intakeAutoRepliesEnabled), which stays off until
// counsel clears NYC Local Law 144. Approvals are recorded either way.
export async function intakeRepliesSendingEnabled(): Promise<boolean> {
  const settings = await prisma.recruiterSettings.findUnique({ where: { id: 'singleton' } })
  return settings?.intakeAutoRepliesEnabled ?? false
}

export async function sendApprovedReply(replyId: string): Promise<'sent' | 'disabled' | 'skipped' | 'failed'> {
  if (!(await intakeRepliesSendingEnabled())) return 'disabled'

  const reply = await prisma.intakeReply.findUnique({
    where: { id: replyId },
    include: { connection: { include: { firm: true, recruiter: true, intakeCandidate: true } } },
  })
  if (!reply || reply.status !== 'APPROVED') return 'skipped'
  const { connection } = reply
  if (connection.disconnectedAt || connection.intakeCandidate.emailOptedOutAt) {
    await prisma.intakeReply.update({
      where: { id: reply.id },
      data: { status: 'CANCELLED', cancelledById: 'system', cancelledAt: new Date() },
    })
    return 'skipped'
  }

  const result = await sendIntakeReply({
    replyId: reply.id,
    to: connection.intakeCandidate.email,
    subject: reply.subject,
    body: reply.body,
    firmName: connection.firm.name,
    recruiterName: connection.recruiter?.fullName ?? connection.firm.name,
    recruiterEmail: connection.recruiter?.workEmail ?? null,
    claimToken: connection.intakeCandidate.claimToken,
    includeClaimLink: !connection.intakeCandidate.claimedAt,
  })

  if (!result.sent) {
    await prisma.intakeReply.update({ where: { id: reply.id }, data: { sendError: result.error ?? 'send failed' } })
    return 'failed'
  }
  await prisma.intakeReply.update({ where: { id: reply.id }, data: { status: 'SENT', sentAt: new Date(), sendError: null } })
  if (!connection.intakeCandidate.claimedAt) {
    await prisma.intakeCandidate.update({
      where: { id: connection.intakeCandidate.id },
      data: { claimInvitesSent: { increment: 1 }, lastClaimInviteAt: new Date() },
    })
  }
  captureServerEvent(connection.intakeCandidate.id, 'talent_reply_sent', {
    firmId: connection.firmId,
    connectionId: connection.id,
    replyId: reply.id,
    kind: reply.kind,
  })
  return 'sent'
}
