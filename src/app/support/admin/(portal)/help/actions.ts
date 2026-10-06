'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { notifyCandidateOfReply } from '@/lib/help/notify'
import { HELP_MESSAGE_MAX } from '@/lib/help/constants'

export type AdminHelpState = { error?: string; sent?: boolean; emailed?: boolean; message?: string } | undefined

const BASE = '/support/admin/help'

/** Your reply: added to the thread and emailed to the candidate. Optionally resolves it. */
export async function replyToHelp(requestId: string, _prev: AdminHelpState, formData: FormData): Promise<AdminHelpState> {
  const admin = await requireAdmin()
  const message = String(formData.get('message') ?? '').replace(/\r\n/g, '\n').trim().slice(0, HELP_MESSAGE_MAX)
  if (!message) return { error: 'Write a reply first.' }
  const resolve = formData.get('resolve') === 'on'
  const request = await prisma.helpRequest.findUnique({ where: { id: requestId }, select: { id: true, createdAt: true, messages: { where: { fromAdmin: true }, take: 1, select: { id: true } } } })
  if (!request) return { error: 'That conversation no longer exists.', message }
  const now = new Date()
  await prisma.helpRequest.update({
    where: { id: requestId },
    data: {
      messages: { create: { body: message, fromAdmin: true, authorEmail: admin.email ?? null } },
      lastMessageAt: now, lastMessageFromAdmin: true,
      ...(resolve ? { status: 'RESOLVED', resolvedAt: now } : {}),
    },
  })
  const emailed = await notifyCandidateOfReply(requestId, message)
  captureServerEvent(admin.email ?? 'admin', 'help_reply_sent', {
    requestId, from: 'admin', resolved: resolve, emailed,
    minutesToFirstReply: request.messages.length === 0 ? Math.round((now.getTime() - request.createdAt.getTime()) / 60000) : null,
  })
  revalidatePath(BASE)
  revalidatePath(`${BASE}/${requestId}`)
  return { sent: true, emailed }
}

export async function setHelpResolved(requestId: string, resolved: boolean): Promise<void> {
  const admin = await requireAdmin()
  await prisma.helpRequest.update({
    where: { id: requestId },
    data: resolved ? { status: 'RESOLVED', resolvedAt: new Date() } : { status: 'OPEN', resolvedAt: null },
  })
  captureServerEvent(admin.email ?? 'admin', resolved ? 'help_request_resolved' : 'help_request_reopened', { requestId })
  revalidatePath(BASE)
  revalidatePath(`${BASE}/${requestId}`)
}

/** A problem report becomes evidence in Vision → Feedback, where it can be linked to a fix item. */
export async function sendHelpToVision(requestId: string): Promise<void> {
  const admin = await requireAdmin()
  const r = await prisma.helpRequest.findUnique({
    where: { id: requestId },
    select: { candidateId: true, contextPath: true, createdAt: true, messages: { where: { fromAdmin: false }, orderBy: { createdAt: 'asc' }, take: 1, select: { body: true } } },
  })
  if (!r || !r.messages[0]) return
  const existing = await prisma.productFeedback.findFirst({ where: { candidateId: r.candidateId, rawText: r.messages[0].body, channel: 'in-app problem' }, select: { id: true } })
  if (!existing) {
    await prisma.productFeedback.create({
      data: { source: 'CANDIDATE', candidateId: r.candidateId, rawText: r.messages[0].body, channel: 'in-app problem', contextPath: r.contextPath, receivedAt: r.createdAt },
    })
  }
  captureServerEvent(admin.email ?? 'admin', 'help_sent_to_vision', { requestId, alreadyThere: !!existing })
  revalidatePath(`${BASE}/${requestId}`)
}
