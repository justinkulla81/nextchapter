import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'

// Opens that Resend saw and we never stored. Before 2026-11-11 13:05 ET the webhook counted an open straight onto the recipient row
// and kept no event; when only human opens were counted, those rows were reset to 0 and there was nothing left to re-judge
// (Susan Kulla, October report, Nov 9; Jason Nickell, Nov 11). Resend still has each email's status.
//
// A recipient is reconciled when we hold no open event and no click event for them, their open count is 0, and Resend says the
// email was opened or clicked. One open is recorded, marked "reported by Resend, time unknown", and the recipient counts as opened.
// Anyone with a stored open or click was already judged by the human rules and is left alone, so a scanner's or Apple Mail
// Privacy Protection's open that we did store stays out. An iCloud address is skipped: its opens are Apple's prefetch.
//
// Known limit: Resend's status cannot tell a person from a mail scanner, so an open-only scanner on a recipient we stored
// nothing for would count once.
export const RECONCILE_BATCH = 100
export const RECONCILE_MIN_AGE_MS = 2 * 60 * 60 * 1000
export const RECONCILE_WINDOW_DAYS = 30
export const RECONCILE_UA = 'reported by Resend, time unknown'
const APPLE_DOMAINS = /@(icloud\.com|me\.com|mac\.com)$/i
const PAUSE_MS = 600 // Resend allows 2 requests a second

export interface ReconcileResult {
  checked: number
  opened: number
  skippedApple: number
  failed: number
  remaining: number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Rows read per run: the candidate query (indexed by sentAt, at most RECONCILE_BATCH rows back) plus one Resend lookup each. */
export async function reconcileOpensFromResend(now: Date = new Date()): Promise<ReconcileResult> {
  const since = new Date(now.getTime() - RECONCILE_WINDOW_DAYS * 86_400_000)
  const before = new Date(now.getTime() - RECONCILE_MIN_AGE_MS)
  const candidates = await prisma.mailingEditionRecipient.findMany({
    where: {
      sentAt: { gte: since, lte: before },
      resendEmailId: { not: null },
      deliveredAt: { not: null },
      openCount: 0,
      reconciledAt: null,
      openEvents: { none: {} },
      clickEvents: { none: {} },
    },
    select: { id: true, email: true, personId: true, resendEmailId: true },
    orderBy: { sentAt: 'asc' },
    take: RECONCILE_BATCH,
  })
  const result: ReconcileResult = { checked: 0, opened: 0, skippedApple: 0, failed: 0, remaining: 0 }
  if (candidates.length === 0) return result
  const resend = createResend(process.env.RESEND_API_KEY)
  for (const r of candidates) {
    result.checked += 1
    if (APPLE_DOMAINS.test(r.email)) {
      result.skippedApple += 1
      await prisma.mailingEditionRecipient.update({ where: { id: r.id }, data: { reconciledAt: now } })
      continue
    }
    const { data, error } = await resend.emails.get(r.resendEmailId as string)
    if (error || !data) {
      result.failed += 1
      await sleep(PAUSE_MS)
      continue
    }
    const seen = data.last_event === 'opened' || data.last_event === 'clicked'
    if (seen) {
      await prisma.mailingOpenEvent.createMany({ data: [{ recipientId: r.id, ip: '', userAgent: RECONCILE_UA, openedAt: now, bot: false }], skipDuplicates: true })
      await prisma.mailingEditionRecipient.update({ where: { id: r.id }, data: { openedAt: now, openCount: 1, reconciledAt: now } })
      if (r.personId) await prisma.crmReportSend.updateMany({ where: { editionRecipientId: r.id, openedAt: null }, data: { openedAt: now } })
      result.opened += 1
    } else {
      await prisma.mailingEditionRecipient.update({ where: { id: r.id }, data: { reconciledAt: now } })
    }
    await sleep(PAUSE_MS)
  }
  result.remaining = await prisma.mailingEditionRecipient.count({
    where: { sentAt: { gte: since, lte: before }, resendEmailId: { not: null }, deliveredAt: { not: null }, openCount: 0, reconciledAt: null, openEvents: { none: {} }, clickEvents: { none: {} } },
  })
  return result
}
