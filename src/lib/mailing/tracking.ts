import 'server-only'
import type { CrmReportSendChannel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { loadScannerBlocks, loadScannerIps } from '@/lib/marketing/mail-scanners'
import { burstClickIds, isHumanClick, isHumanOpen } from './click-human'
import { suppress } from './lists'
import { baseSubject, isUnsubscribeReply } from './replies'
import { applyOptOutReply } from './opt-out'

/** Resend's webhook events this app acts on. */
export type ResendEvent = {
  type: string
  created_at?: string
  data: { email_id?: string; to?: string[]; bounce?: { type?: string; subType?: string; message?: string }; click?: { link?: string; ipAddress?: string; userAgent?: string; timestamp?: string }; open?: { ipAddress?: string; userAgent?: string; timestamp?: string } }
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
  if (!r) return applyJobSearchDailyEvent(event, emailId)
  const at = event.created_at ? new Date(event.created_at) : new Date()
  const reportSend = r.personId ? { editionRecipientId: r.id } : null

  switch (event.type) {
    case 'email.delivered':
      await prisma.mailingEditionRecipient.update({ where: { id: r.id }, data: { deliveredAt: r.deliveredAt ?? at } })
      break
    case 'email.delivery_delayed':
      await prisma.mailingEditionRecipient.update({ where: { id: r.id }, data: { delayedAt: at } })
      break
    case 'email.opened': {
      // A machine's open (a scanner, Apple Mail Privacy Protection) is kept so the log can tell, but is not counted as an open.
      const human = await saveOpen(r.id, event, at, r.deliveredAt)
      if (!human) break
      const openedAt = openTime(event, at)
      await prisma.mailingEditionRecipient.update({
        where: { id: r.id }, data: { openedAt: r.openedAt ?? openedAt, openCount: { increment: 1 } },
      })
      if (reportSend) await prisma.crmReportSend.updateMany({ where: { ...reportSend, openedAt: null }, data: { openedAt } })
      break
    }
    case 'email.clicked': {
      // A scanner's click is kept (so the visitor log can tell scanners from people) but never counted as a click.
      const human = await saveClick(r.id, event, at, r.deliveredAt)
      if (!human) break
      // The unsubscribe link is a click too, but not interest in the report.
      if (event.data.click?.link?.includes('/updates/unsubscribe/')) break
      await prisma.mailingEditionRecipient.update({
        where: { id: r.id }, data: { clickedAt: r.clickedAt ?? at, clickCount: { increment: 1 } },
      })
      if (reportSend) await prisma.crmReportSend.updateMany({ where: { ...reportSend, clickedAt: null }, data: { clickedAt: at } })
      // A person who clicked a link opened the email, whether or not the tracking pixel was reported (Gmail and others often block
      // it, and Resend open tracking can be off). Count that one open when none was seen.
      await prisma.mailingEditionRecipient.updateMany({ where: { id: r.id, openCount: 0 }, data: { openCount: 1, openedAt: r.openedAt ?? at } })
      if (reportSend) await prisma.crmReportSend.updateMany({ where: { ...reportSend, openedAt: null }, data: { openedAt: at } })
      break
    }
    case 'email.bounced': {
      const detail = [event.data.bounce?.type, event.data.bounce?.subType, event.data.bounce?.message].filter(Boolean).join(' · ')
      await prisma.mailingEditionRecipient.update({ where: { id: r.id }, data: { bouncedAt: at, bounceDetail: detail.slice(0, 500) || null } })
      // Owner rule (2026-11-10): any bounce, permanent or not, takes the address off every list.
      await suppress(r.email, 'BOUNCED', detail)
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
 * Keeps the click's address, browser and time, and says whether a person made it (see click-human.ts). Never blocks the event;
 * when the click cannot be judged (no click detail, or the table cannot be written) it counts, as before.
 *
 * A scanner usually shows itself only by the next click: the first one looks like a person's. So after saving, the recipient's
 * clicks are checked together; any earlier click that turns out to belong to a burst is flagged and taken back out of the counts.
 */
async function saveClick(recipientId: string, event: ResendEvent, fallbackAt: Date, deliveredAt: Date | null): Promise<boolean> {
  const click = event.data.click
  if (!click) return true
  try {
    const stamp = click.timestamp ? new Date(click.timestamp) : fallbackAt
    const at = Number.isNaN(stamp.getTime()) ? fallbackAt : stamp
    const ip = click.ipAddress?.slice(0, 64) || null
    const userAgent = click.userAgent?.slice(0, 300) || null
    const [scanners, blocks] = await Promise.all([
      loadScannerIps().catch(() => new Set<string>()),
      loadScannerBlocks().catch(() => new Set<string>()),
    ])
    const human = isHumanClick({ ip, userAgent, at, deliveredAt }, scanners, blocks)
    const link = (click.link ?? '').slice(0, 500)
    const saved = await prisma.mailingClickEvent.createMany({ data: [{ recipientId, ip, userAgent, link, clickedAt: at, bot: !human }], skipDuplicates: true })
    if (saved.count === 0) return false // the same click delivered again: already handled
    const all = await prisma.mailingClickEvent.findMany({ where: { recipientId }, select: { id: true, ip: true, clickedAt: true, bot: true, link: true } })
    const bursts = burstClickIds(all.map((c) => ({ id: c.id, ip: c.ip, at: c.clickedAt })))
    const flipped = all.filter((c) => !c.bot && bursts.has(c.id))
    if (flipped.length === 0) return human
    await prisma.mailingClickEvent.updateMany({ where: { id: { in: flipped.map((c) => c.id) } }, data: { bot: true } })
    // The click just saved was never counted; the earlier ones were.
    const newOne = flipped.find((c) => c.ip === ip && c.clickedAt.getTime() === at.getTime() && c.link === link)
    const wasCounted = flipped.length - (newOne ? 1 : 0)
    if (wasCounted > 0) await takeBackCounts(recipientId, wasCounted)
    return newOne ? false : human
  } catch (error) {
    console.error('Saving the click address failed:', error)
    return true
  }
}

/** The moment of the open as Resend recorded it (the event's own time otherwise). */
function openTime(event: ResendEvent, fallbackAt: Date): Date {
  const stamp = event.data.open?.timestamp ? new Date(event.data.open.timestamp) : fallbackAt
  return Number.isNaN(stamp.getTime()) ? fallbackAt : stamp
}

/** Keeps the open's address, browser and time and says whether a person made it. Never blocks the event; an open that cannot be judged counts, as before. */
async function saveOpen(recipientId: string, event: ResendEvent, fallbackAt: Date, deliveredAt: Date | null): Promise<boolean> {
  const open = event.data.open
  if (!open) return true
  try {
    const at = openTime(event, fallbackAt)
    const ip = open.ipAddress?.slice(0, 64) || ''
    const userAgent = open.userAgent?.slice(0, 300) || null
    const [scanners, blocks] = await Promise.all([
      loadScannerIps().catch(() => new Set<string>()),
      loadScannerBlocks().catch(() => new Set<string>()),
    ])
    const human = isHumanOpen({ ip: ip || null, userAgent, at, deliveredAt }, scanners, blocks)
    const saved = await prisma.mailingOpenEvent.createMany({ data: [{ recipientId, ip, userAgent, openedAt: at, bot: !human }], skipDuplicates: true })
    return saved.count === 0 ? false : human // the same open delivered again was already handled
  } catch (error) {
    console.error('Saving the open address failed:', error)
    return true
  }
}

/** Removes clicks that turned out to be a scanner's from the recipient's count; with none left, the recipient has not clicked. */
async function takeBackCounts(recipientId: string, n: number): Promise<void> {
  await prisma.mailingEditionRecipient.update({ where: { id: recipientId }, data: { clickCount: { decrement: n } } })
  const now = await prisma.mailingEditionRecipient.findUnique({ where: { id: recipientId }, select: { clickCount: true } })
  if (now && now.clickCount <= 0) {
    await prisma.mailingEditionRecipient.update({ where: { id: recipientId }, data: { clickCount: 0, clickedAt: null } })
    await prisma.crmReportSend.updateMany({ where: { editionRecipientId: recipientId }, data: { clickedAt: null } })
  }
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

  // A plain "no" / "stop" to a report or edition takes them off everything, without waiting for the queue.
  if (ctx.knownEmails.has(email)) await applyOptOutReply({ messageId: msg.id, email, subject: msg.subject, text: msg.snippet })

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

/**
 * Job Search Daily is candidate mail, not an edition, so its Resend events
 * land on JobSearchDailySend. Unknown ids are still ignored. Opens and
 * clicks also go to PostHog (low volume) so they show in funnels.
 */
async function applyJobSearchDailyEvent(event: ResendEvent, emailId: string): Promise<'applied' | 'ignored'> {
  const send = await prisma.jobSearchDailySend.findUnique({ where: { resendEmailId: emailId } })
  if (!send) return 'ignored'
  const at = event.created_at ? new Date(event.created_at) : new Date()

  switch (event.type) {
    case 'email.delivered':
      await prisma.jobSearchDailySend.update({ where: { id: send.id }, data: { deliveredAt: send.deliveredAt ?? at } })
      break
    case 'email.opened':
      await prisma.jobSearchDailySend.update({
        where: { id: send.id }, data: { openedAt: send.openedAt ?? at, openCount: { increment: 1 } },
      })
      if (!send.openedAt) captureServerEvent(send.candidateId, 'job_search_daily_opened', { sendId: send.id })
      break
    case 'email.clicked': {
      // The unsubscribe link is a click too, but not engagement.
      const link = event.data.click?.link ?? null
      if (link?.includes('/api/unsubscribe/') || link?.includes('/api/e/jsd')) break // own tracker records these
      await prisma.jobSearchDailySend.update({
        where: { id: send.id },
        data: { clickedAt: send.clickedAt ?? at, clickCount: { increment: 1 }, lastClickLink: link?.slice(0, 500) ?? null },
      })
      captureServerEvent(send.candidateId, 'job_search_daily_clicked', { sendId: send.id, link })
      break
    }
    case 'email.bounced':
      await prisma.jobSearchDailySend.update({ where: { id: send.id }, data: { bouncedAt: at } })
      break
    default:
      return 'ignored'
  }
  return 'applied'
}
