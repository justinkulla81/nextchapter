import 'server-only'
import type { CrmReportSendChannel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { suppress } from './lists'
import { baseSubject, isUnsubscribeReply } from './replies'

/** Resend's webhook events this app acts on. */
export type ResendEvent = {
  type: string
  created_at?: string
  data: { email_id?: string; to?: string[]; bounce?: { type?: string; subType?: string; message?: string }; click?: { link?: string } }
}

/**
 * Applies one Resend webhook event to the edition roster and the person's
 * report record. Unknown email ids are ignored: Resend posts events for
 * every email the account sends, most of which aren't list mail.
 */
export async function applyResendEvent(event: ResendEvent): Promise<'applied' | 'ignored'> {
  const emailId = event.data?.email_id
  if (!emailId) return 'ignored'
  const r = await prisma.mailingEditionRecipient.findUnique({ where: { resendEmailId: emailId } })
  if (!r) return 'ignored'
  const at = event.created_at ? new Date(event.created_at) : new Date()
  const reportSend = r.personId ? { editionRecipientId: r.id } : null

  switch (event.type) {
    case 'email.delivered':
      await prisma.mailingEditionRecipient.update({ where: { id: r.id }, data: { deliveredAt: r.deliveredAt ?? at } })
      break
    case 'email.delivery_delayed':
      await prisma.mailingEditionRecipient.update({ where: { id: r.id }, data: { delayedAt: at } })
      break
    case 'email.opened':
      await prisma.mailingEditionRecipient.update({
        where: { id: r.id }, data: { openedAt: r.openedAt ?? at, openCount: { increment: 1 } },
      })
      if (reportSend) await prisma.crmReportSend.updateMany({ where: { ...reportSend, openedAt: null }, data: { openedAt: at } })
      break
    case 'email.clicked': {
      // The unsubscribe link is a click too, but not interest in the report.
      if (event.data.click?.link?.includes('/updates/unsubscribe/')) break
      await prisma.mailingEditionRecipient.update({
        where: { id: r.id }, data: { clickedAt: r.clickedAt ?? at, clickCount: { increment: 1 } },
      })
      if (reportSend) await prisma.crmReportSend.updateMany({ where: { ...reportSend, clickedAt: null }, data: { clickedAt: at } })
      break
    }
    case 'email.bounced': {
      const detail = [event.data.bounce?.type, event.data.bounce?.subType, event.data.bounce?.message].filter(Boolean).join(' · ')
      await prisma.mailingEditionRecipient.update({ where: { id: r.id }, data: { bouncedAt: at, bounceDetail: detail.slice(0, 500) || null } })
      // A temporary bounce is Resend still trying; only a permanent one stops mail.
      if (!/transient|temporary/i.test(event.data.bounce?.type ?? '')) await suppress(r.email, 'BOUNCED', detail)
      break
    }
    case 'email.complained':
      await prisma.mailingEditionRecipient.update({ where: { id: r.id }, data: { complainedAt: at } })
      await suppress(r.email, 'COMPLAINED', 'Marked as spam')
      break
    default:
      return 'ignored'
  }
  return 'applied'
}

/**
 * Records that someone got a report edition by hand. Never downgrades an
 * AUTOMATED row (the system's record is the stronger one).
 */
export async function markReportManual(input: {
  personId: string
  editionKey: string
  channel: CrmReportSendChannel
  sentAt: Date
  activityId?: string | null
  subject?: string | null
  markedByEmail?: string | null
}): Promise<'created' | 'updated' | 'kept_automated'> {
  const existing = await prisma.crmReportSend.findUnique({ where: { personId_editionKey: { personId: input.personId, editionKey: input.editionKey } } })
  if (existing?.method === 'AUTOMATED') return 'kept_automated'
  const data = {
    method: 'MANUAL' as const, channel: input.channel, sentAt: input.sentAt,
    activityId: input.activityId ?? existing?.activityId ?? null, subject: input.subject ?? existing?.subject ?? null,
    markedByEmail: input.markedByEmail ?? existing?.markedByEmail ?? null,
  }
  if (existing) {
    await prisma.crmReportSend.update({ where: { id: existing.id }, data })
    return 'updated'
  }
  await prisma.crmReportSend.create({ data: { personId: input.personId, editionKey: input.editionKey, ...data } })
  return 'created'
}

// ── Gmail sync hooks ─────────────────────────────────────────────────────────

const REPLY_WINDOW_MS = 14 * 86_400_000

export interface MailingSweepContext {
  /** Addresses that are on a list or were sent an edition. */
  knownEmails: Set<string>
  /** baseSubject → sends that could be replied to, newest first. */
  openSends: { email: string; personId: string | null; subjectKey: string; sentAt: Date; reportSendId: string | null; recipientId: string | null }[]
}

export async function buildMailingSweepContext(): Promise<MailingSweepContext> {
  const since = new Date(Date.now() - REPLY_WINDOW_MS - 7 * 86_400_000)
  const [members, recipients, manual] = await Promise.all([
    prisma.mailingListMember.findMany({ select: { email: true } }),
    prisma.mailingEditionRecipient.findMany({
      where: { sentAt: { gte: since } },
      select: { id: true, email: true, personId: true, sentAt: true, repliedAt: true, edition: { select: { subject: true } } },
    }),
    prisma.crmReportSend.findMany({
      where: { sentAt: { gte: since }, method: 'MANUAL', channel: 'EMAIL', repliedAt: null, subject: { not: null } },
      select: { id: true, personId: true, sentAt: true, subject: true, person: { select: { email: true, emails: true } } },
    }),
  ])
  const knownEmails = new Set<string>([...members.map((m) => m.email), ...recipients.map((r) => r.email)])
  const openSends: MailingSweepContext['openSends'] = []
  for (const r of recipients) {
    if (r.repliedAt || !r.sentAt) continue
    openSends.push({ email: r.email, personId: r.personId, subjectKey: baseSubject(r.edition.subject), sentAt: r.sentAt, reportSendId: null, recipientId: r.id })
  }
  for (const m of manual) {
    for (const e of new Set([m.person.email, ...m.person.emails].filter(Boolean) as string[])) {
      openSends.push({ email: e.toLowerCase(), personId: m.personId, subjectKey: baseSubject(m.subject), sentAt: m.sentAt, reportSendId: m.id, recipientId: null })
    }
  }
  return { knownEmails, openSends }
}

/**
 * Looks at one inbound message for the mailing lists: an "unsubscribe"
 * reply goes to the Process unsubscribes queue, and a reply to a report or
 * an edition sets repliedAt. Headers and snippet only — no extra fetch.
 */
export async function onInboundMessage(
  ctx: MailingSweepContext,
  msg: { id: string; fromEmail: string; subject: string | null; snippet: string | null; at: Date },
): Promise<void> {
  const email = msg.fromEmail.toLowerCase()
  if (isUnsubscribeReply(msg.subject, msg.snippet) && (ctx.knownEmails.has(email) || /unsubscribe/i.test(msg.subject ?? ''))) {
    const personId = (await prisma.crmPerson.findFirst({
      where: { deletedAt: null, OR: [{ email: { equals: email, mode: 'insensitive' } }, { emails: { has: email } }] }, select: { id: true },
    }))?.id ?? null
    await prisma.mailingUnsubscribeRequest.upsert({
      where: { gmailMessageId: msg.id },
      create: { gmailMessageId: msg.id, email, personId, subject: msg.subject?.slice(0, 300) ?? null, snippet: msg.snippet?.slice(0, 500) ?? null, receivedAt: msg.at },
      update: {},
    })
  }

  const key = baseSubject(msg.subject)
  if (!key) return
  for (const s of ctx.openSends) {
    if (s.email !== email || s.subjectKey !== key) continue
    if (msg.at < s.sentAt || msg.at.getTime() - s.sentAt.getTime() > REPLY_WINDOW_MS) continue
    if (s.recipientId) {
      const r = await prisma.mailingEditionRecipient.update({ where: { id: s.recipientId }, data: { repliedAt: msg.at } })
      await prisma.crmReportSend.updateMany({ where: { editionRecipientId: r.id, repliedAt: null }, data: { repliedAt: msg.at } })
    }
    if (s.reportSendId) await prisma.crmReportSend.updateMany({ where: { id: s.reportSendId, repliedAt: null }, data: { repliedAt: msg.at } })
  }
}
