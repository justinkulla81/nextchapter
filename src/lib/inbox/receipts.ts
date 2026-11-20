import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { captureServerEvent } from '@/lib/posthog/server'
import { getAllGoogleConnections, getValidAccessTokenFor } from '@/lib/google/connection'
import { getMessageHeaders, listMessagesForSearch, type GmailHeaderMessage } from '@/lib/google/gmail'
import { layoffReceiptText, replySubject } from './receipt-text'

// Receipts for what the owner emails to news@ and layoffs@ (owner request, 2026-11-20). Both addresses are aliases on the
// connected Google mailboxes, not on the Resend inbound domain, so mail sent there is found by a Gmail search, not a webhook.
//
// One receipt per email, however many mailboxes hold a copy (the owner's Sent folder and the company inbox both do): the
// claim is keyed on the RFC 822 Message-ID, which every copy shares, and stored in NewsletterMessage (same idempotence table
// the news@ sweep uses).

export const LAYOFFS_ADDRESS = 'layoffs@launchyournextchapter.com'
const FROM = 'NextChapter <support@launchyournextchapter.com>'
/** A layoffs@ email older than this gets no receipt: it predates the receipts, or a run was missed for days. */
const LAYOFF_LOOKBACK = '2d'
const MAX_LAYOFF_EMAILS = 10

const receiptKey = (message: Pick<GmailHeaderMessage, 'id' | 'rfcMessageId'>) =>
  `receipt:${(message.rfcMessageId ?? `gmail:${message.id}`).slice(0, 300)}`

/** Claims the receipt for one email. True once per Message-ID across every mailbox and every run. */
export async function claimReceipt(message: Pick<GmailHeaderMessage, 'id' | 'rfcMessageId'>): Promise<boolean> {
  const { count } = await prisma.newsletterMessage.createMany({ data: [{ messageId: receiptKey(message), events: 0 }], skipDuplicates: true })
  return count === 1
}

/** Gives a claim back after a failed send, so the next run tries again. */
export async function releaseReceipt(message: Pick<GmailHeaderMessage, 'id' | 'rfcMessageId'>): Promise<void> {
  await prisma.newsletterMessage.deleteMany({ where: { messageId: receiptKey(message) } }).catch(() => {})
}

/**
 * Claims, sends, and gives the claim back if the send failed. 'duplicate': a receipt for this email was already sent
 * (from another mailbox's copy or an earlier run). 'failed': nothing sent, and the next run may try again.
 */
export async function sendReceiptOnce(args: Parameters<typeof sendReceipt>[0]): Promise<'sent' | 'duplicate' | 'failed'> {
  if (!(await claimReceipt(args.message))) return 'duplicate'
  if (await sendReceipt(args)) return 'sent'
  await releaseReceipt(args.message)
  return 'failed'
}

/** The sender's bare address from a From header ("Name <a@b.c>" or "a@b.c"). */
export function senderAddress(from: string | null): string | null {
  const m = from?.match(/<([^>]+)>/)?.[1] ?? from
  const email = m?.trim().toLowerCase()
  return email && /^[^\s@]+@[^\s@]+$/.test(email) ? email : null
}

/** Sends the receipt as a reply on the owner's own thread. Never throws: a failed receipt must not stop the filing. */
export async function sendReceipt(args: {
  message: GmailHeaderMessage
  address: 'news' | 'layoffs'
  text: string
  extra?: Record<string, unknown>
}): Promise<boolean> {
  const to = senderAddress(args.message.from)
  if (!to || !process.env.RESEND_API_KEY) return false
  const threading = args.message.rfcMessageId
    ? { 'In-Reply-To': args.message.rfcMessageId, References: args.message.rfcMessageId }
    : undefined
  try {
    const { error } = await createResend(process.env.RESEND_API_KEY, 'admin').emails.send({
      from: FROM,
      to,
      subject: replySubject(args.message.subject),
      text: args.text,
      ...(threading ? { headers: threading } : {}),
    })
    if (error) throw new Error(error.message)
    captureServerEvent(to, 'inbox_receipt_sent', { address: args.address, gmailMessageId: args.message.id, ...args.extra })
    return true
  } catch (e) {
    console.error('Inbox receipt failed:', args.address, args.message.id, e)
    return false
  }
}

/**
 * Sends a receipt for each new email the owner sent to layoffs@. The filing itself is the layoffs@ process in CLAUDE.md;
 * this only says the email arrived and how it is used.
 */
export async function sendLayoffReceipts(senders: string[]): Promise<{ checked: number; sent: number }> {
  const result = { checked: 0, sent: 0 }
  if (senders.length === 0) return result
  const query = `to:${LAYOFFS_ADDRESS} from:(${senders.join(' OR ')}) newer_than:${LAYOFF_LOOKBACK}`
  for (const connection of await getAllGoogleConnections()) {
    try {
      const token = await getValidAccessTokenFor(connection)
      const listed = await listMessagesForSearch(token, query, MAX_LAYOFF_EMAILS)
      if (listed.length === 0) continue
      // Remember each Gmail id once handled, so a run every 5 minutes does not re-fetch the same headers for two days.
      const seenKeys = listed.map((m) => `receipt-seen:${m.id}`)
      const seen = new Set(
        (await prisma.newsletterMessage.findMany({ where: { messageId: { in: seenKeys } }, select: { messageId: true } })).map((r) => r.messageId),
      )
      for (const m of listed) {
        if (seen.has(`receipt-seen:${m.id}`)) continue
        const headers = await getMessageHeaders(token, m.id)
        result.checked++
        if (headers) {
          const outcome = await sendReceiptOnce({ message: headers, address: 'layoffs', text: layoffReceiptText() })
          if (outcome === 'failed') continue // not marked seen: the next run tries again
          if (outcome === 'sent') result.sent++
        }
        await prisma.newsletterMessage.createMany({ data: [{ messageId: `receipt-seen:${m.id}`, events: 0 }], skipDuplicates: true })
      }
    } catch (e) {
      console.error('Layoff receipts: could not read mailbox', connection.email, e)
    }
  }
  return result
}
