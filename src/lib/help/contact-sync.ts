import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * A /contact message creates two records: the ContactSubmission (Contact
 * messages queue, CRM filing) and a Help inbox conversation (portal PUBLIC).
 * They are one thing to the person who wrote in, so resolving either one
 * resolves the other. They share no id, so they are matched on who wrote, what
 * they wrote and when. Best effort: a failure here never blocks the action.
 */

const WITHIN_MS = 2 * 60 * 1000

async function helpFor(sub: { email: string; message: string; createdAt: Date }) {
  const near = await prisma.helpRequest.findMany({
    where: {
      portal: 'PUBLIC',
      requesterEmail: { equals: sub.email, mode: 'insensitive' },
      createdAt: { gte: new Date(sub.createdAt.getTime() - WITHIN_MS), lte: new Date(sub.createdAt.getTime() + WITHIN_MS) },
    },
    select: { id: true, messages: { orderBy: { createdAt: 'asc' }, take: 1, select: { body: true } } },
  })
  return near.find((r) => r.messages[0]?.body.trim() === sub.message.trim()) ?? null
}

/** Contact message marked handled or reopened: do the same to its Help conversation. */
export async function syncHelpFromContact(submissionId: string, handled: boolean): Promise<void> {
  try {
    const sub = await prisma.contactSubmission.findUnique({ where: { id: submissionId }, select: { email: true, message: true, createdAt: true } })
    if (!sub) return
    const help = await helpFor(sub)
    if (!help) return
    await prisma.helpRequest.update({
      where: { id: help.id },
      data: handled ? { status: 'RESOLVED', resolvedAt: new Date() } : { status: 'OPEN', resolvedAt: null },
    })
  } catch (e) {
    console.error('Could not sync the Help conversation from a contact message:', e)
  }
}

/** Help conversation resolved or reopened: do the same to its contact message, if it came from /contact. */
export async function syncContactFromHelp(requestId: string, resolved: boolean, adminEmail: string | null): Promise<void> {
  try {
    const r = await prisma.helpRequest.findUnique({
      where: { id: requestId },
      select: { portal: true, requesterEmail: true, createdAt: true, messages: { orderBy: { createdAt: 'asc' }, take: 1, select: { body: true } } },
    })
    if (!r || r.portal !== 'PUBLIC' || !r.requesterEmail || !r.messages[0]) return
    const subs = await prisma.contactSubmission.findMany({
      where: {
        email: { equals: r.requesterEmail, mode: 'insensitive' },
        createdAt: { gte: new Date(r.createdAt.getTime() - WITHIN_MS), lte: new Date(r.createdAt.getTime() + WITHIN_MS) },
      },
      select: { id: true, message: true },
    })
    const sub = subs.find((s) => s.message.trim() === r.messages[0].body.trim())
    if (!sub) return
    await prisma.contactSubmission.update({
      where: { id: sub.id },
      data: resolved ? { handledAt: new Date(), handledBy: adminEmail } : { handledAt: null, handledBy: null },
    })
  } catch (e) {
    console.error('Could not sync the contact message from a Help conversation:', e)
  }
}
