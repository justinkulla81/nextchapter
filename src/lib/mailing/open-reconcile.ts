import { prisma } from '@/lib/prisma'

// Resend's own status for each email ("opened", "clicked", ...) is the record that cannot lose an event; the webhook can (a
// dropped delivery, or open tracking switched off for a while). This reads the recent emails from Resend's list and, for a
// recipient who has no open of any kind stored (no MailingOpenEvent, human or machine), counts one open when Resend says the
// email was opened.
//
// Limit: Resend's "opened" also covers Apple Mail Privacy Protection and mail scanners, and the list does not say which. Where we
// stored an open we already judged it (bot or human) and leave it alone; only recipients with nothing stored are filled in, so
// some of those can be a machine's open. The row it writes says so in its browser field.
//
// Cost: about one Resend request per 100 emails sent in the last 21 days (about 45), and one database read and at most one
// write per page, selecting only ids.
export const RECONCILE_LOOKBACK_DAYS = 21
const PAGE = 100
const MAX_PAGES = 80
const PAUSE_MS = 600
export const RECONCILED_AGENT = 'reconciled from Resend status (not checked for machine opens)'

interface ResendListedEmail {
  id: string
  created_at: string
  last_event?: string | null
}

async function listPage(apiKey: string, after: string | null): Promise<{ data: ResendListedEmail[]; has_more: boolean }> {
  const url = new URL('https://api.resend.com/emails')
  url.searchParams.set('limit', String(PAGE))
  if (after) url.searchParams.set('after', after)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
  if (res.status === 429) throw new Error('Resend rate limit reached')
  if (!res.ok) throw new Error(`Resend email list failed: ${res.status}`)
  return (await res.json()) as { data: ResendListedEmail[]; has_more: boolean }
}

export interface ReconcileResult {
  pages: number
  listed: number
  opened: number
  filled: number
  stoppedBecause: 'end' | 'older' | 'page-limit'
}

/**
 * Cross-reference: a person who replied, unsubscribed or clicked (clicks are already judged human before they set clickedAt)
 * read the email, whatever the pixel said. One statement over the last 21 days' recipients with no open counted; it returns
 * a count only. The time of the open is the first of those actions, which is the latest it can have been.
 */
export async function inferOpensFromActions(): Promise<number> {
  const since = new Date(Date.now() - RECONCILE_LOOKBACK_DAYS * 86_400_000)
  return prisma.$executeRaw`
    UPDATE "MailingEditionRecipient"
    SET "openCount" = 1, "openedAt" = COALESCE("openedAt", LEAST("repliedAt", "clickedAt", "unsubscribedAt"))
    WHERE "openCount" = 0 AND "sentAt" >= ${since}
      AND ("repliedAt" IS NOT NULL OR "clickedAt" IS NOT NULL OR "unsubscribedAt" IS NOT NULL)`
}

export async function reconcileOpensFromResend(): Promise<ReconcileResult & { inferred: number }> {
  const inferred = await inferOpensFromActions()
  return { ...(await reconcileFromResendStatus()), inferred }
}

async function reconcileFromResendStatus(): Promise<ReconcileResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not set')
  const since = Date.now() - RECONCILE_LOOKBACK_DAYS * 86_400_000
  const out: ReconcileResult = { pages: 0, listed: 0, opened: 0, filled: 0, stoppedBecause: 'end' }
  let after: string | null = null
  for (;;) {
    if (out.pages >= MAX_PAGES) { out.stoppedBecause = 'page-limit'; break }
    const page = await listPage(apiKey, after)
    out.pages++
    out.listed += page.data.length
    const opened = page.data.filter((e) => e.last_event === 'opened').map((e) => e.id)
    out.opened += opened.length
    if (opened.length > 0) {
      const rows = await prisma.mailingEditionRecipient.findMany({
        where: { resendEmailId: { in: opened }, openCount: 0, openEvents: { none: {} } },
        select: { id: true, openedAt: true, deliveredAt: true, sentAt: true },
      })
      for (const r of rows) {
        const at = r.openedAt ?? r.deliveredAt ?? r.sentAt ?? new Date()
        await prisma.mailingOpenEvent.createMany({ data: [{ recipientId: r.id, ip: '', userAgent: RECONCILED_AGENT, openedAt: at, bot: false }], skipDuplicates: true })
        await prisma.mailingEditionRecipient.updateMany({ where: { id: r.id, openCount: 0 }, data: { openCount: 1, openedAt: at } })
        out.filled++
      }
    }
    const last = page.data[page.data.length - 1]
    if (!page.has_more || !last) break
    if (new Date(last.created_at).getTime() < since) { out.stoppedBecause = 'older'; break }
    after = last.id
    await new Promise((r) => setTimeout(r, PAUSE_MS))
  }
  return out
}
