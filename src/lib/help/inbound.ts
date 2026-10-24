import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { HELP_MESSAGE_MAX, mentionsCrisis } from '@/lib/help/constants'
import { stripQuotedReply } from '@/lib/help/strip-quoted'
import { notifyAdminOfHelpReply } from '@/lib/help/notify'

export type HelpReplyResult = 'added' | 'unknown_request' | 'sender_mismatch' | 'empty'

/**
 * Adds an emailed reply to its conversation. The sender must be the person who
 * wrote in: an address that only knows the request id cannot write into
 * someone else's thread. A mismatch is not added; the admin is told instead.
 */
export async function addEmailedHelpReply(requestId: string, fromEmail: string | null, rawBody: string): Promise<HelpReplyResult> {
  const r = await prisma.helpRequest.findUnique({
    where: { id: requestId },
    select: { id: true, candidateId: true, requesterEmail: true, flaggedCrisis: true, portal: true },
  })
  if (!r) return 'unknown_request'

  const body = stripQuotedReply(rawBody).slice(0, HELP_MESSAGE_MAX)
  if (!body) return 'empty'

  const expected = r.candidateId
    ? (await prisma.candidateProfile.findUnique({ where: { id: r.candidateId }, select: { email: true } }))?.email
    : r.requesterEmail
  const from = fromEmail?.toLowerCase() ?? null
  if (!from || !expected || from !== expected.toLowerCase()) {
    await notifyAdminOfHelpReply(requestId, body, from ?? 'unknown sender', true)
    captureServerEvent(r.id, 'help_reply_email_rejected', { requestId, portal: r.portal })
    return 'sender_mismatch'
  }

  const crisis = mentionsCrisis(body)
  const now = new Date()
  await prisma.helpRequest.update({
    where: { id: requestId },
    data: {
      messages: { create: { body } },
      lastMessageAt: now, lastMessageFromAdmin: false,
      // Writing back reopens a resolved conversation.
      status: 'OPEN', resolvedAt: null,
      flaggedCrisis: r.flaggedCrisis || crisis,
    },
  })
  await notifyAdminOfHelpReply(requestId, body, from, false)
  captureServerEvent(r.id, 'help_reply_sent', { requestId, from: 'requester_email', portal: r.portal, crisis })
  return 'added'
}
