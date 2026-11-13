import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { getMailingSettings } from '@/lib/mailing/lists'
import type { DraftContext } from '@/lib/warn/layoff-alert-drafts'
import type { ContactGroup } from '@/lib/warn/layoff-alert-rules'
import { AUDIENCE_LABEL, CAMPAIGN, CONTACT_COOLDOWN_DAYS, planOutreach } from './plan'

/** A layoff older than this when its alert finally goes out (a held alert) is not emailed about. */
const MAX_NOTICE_AGE_DAYS = 5

/** Off only when LAYOFF_OUTREACH is set to 0 or off; owner decision 2026-11-13: email about every future layoff alert. */
export const outreachEnabled = () => !/^(0|off|false)$/i.test(process.env.LAYOFF_OUTREACH ?? '')

export interface OutreachResult { editions: number; recipients: number; skipped: string | null }

/**
 * Called once, right after a layoff alert goes to Justin. Makes one edition per audience and note (HR, Rapid Response,
 * workforce board, job center, economic development) with the layoff's contacts as the recipients, and starts it sending: the
 * mailing tool's send window (7 to 5 Eastern), hourly rate and daily cap, suppression list and unsubscribe handling all apply,
 * and opens, clicks, replies and unsubscribes are tracked on the edition. Justin is copied (BCC) on each send.
 * Reads: one notice, one settings row, up to ~14 addresses against the suppression table and last week's outreach.
 * Never throws; a failure here must not undo the alert.
 */
export async function queueLayoffOutreach(input: { noticeId: string; employer: string; groups: ContactGroup[]; ctx: DraftContext }): Promise<OutreachResult> {
  const none = (skipped: string): OutreachResult => ({ editions: 0, recipients: 0, skipped })
  try {
    if (!outreachEnabled()) return none('switched off')
    const notice = await prisma.warnNotice.findUnique({ where: { id: input.noticeId }, select: { fetchedAt: true, dismissedAt: true } })
    if (!notice || notice.dismissedAt) return none('notice dismissed or missing')
    if (Date.now() - notice.fetchedAt.getTime() > MAX_NOTICE_AGE_DAYS * 86_400_000) return none('notice too old')
    // One set of emails per layoff, ever.
    if (await prisma.mailingEdition.findFirst({ where: { campaign: CAMPAIGN, warnNoticeId: input.noticeId }, select: { id: true } })) return none('already queued')

    const settings = await getMailingSettings()
    // CAN-SPAM: a send needs a postal address. The signature carries one, but the mailing tool blocks sends while this is empty, so does this.
    if (!settings.postalAddress.trim()) return none('no postal address in mailing settings')

    const candidates = new Set<string>()
    for (const g of input.groups) for (const c of g.cards) if (c.email) candidates.add(c.email.trim().toLowerCase())
    const list = [...candidates]
    const since = new Date(Date.now() - CONTACT_COOLDOWN_DAYS * 86_400_000)
    const [suppressed, recent] = list.length
      ? await Promise.all([
          prisma.mailingSuppression.findMany({ where: { email: { in: list } }, select: { email: true } }),
          prisma.mailingEditionRecipient.findMany({
            where: { email: { in: list }, excluded: false, edition: { campaign: CAMPAIGN, createdAt: { gte: since } } },
            select: { email: true },
          }),
        ])
      : [[], []]
    const blocked = new Set<string>([...suppressed.map((s) => s.email), ...recent.map((r) => r.email)])
    const own = new Set([settings.testEmail, settings.replyTo, 'justin@launchyournextchapter.com'].map((e) => e.toLowerCase()))

    const plans = planOutreach(input.groups, input.ctx, { blocked, ownAddresses: own })
    if (plans.length === 0) return none('no contact with a verified address')

    const bcc = settings.testEmail
    let recipients = 0
    for (const [i, p] of plans.entries()) {
      const key = `lo-${input.noticeId}-${p.audience}-${i + 1}`
      const edition = await prisma.mailingEdition.create({
        data: {
          key,
          title: `${input.employer} · ${AUDIENCE_LABEL[p.audience]}${p.variant ? ` · subject ${p.variant}` : ''}`,
          subject: p.subject,
          bodyHtml: p.bodyHtml,
          status: 'SENDING',
          sendStartedAt: new Date(),
          createdByEmail: 'layoff-outreach',
          campaign: CAMPAIGN,
          warnNoticeId: input.noticeId,
          audience: p.audience,
          bccEmail: bcc,
          recipients: { create: p.recipients.map((r) => ({ email: r.email, personId: r.personId, source: 'ADDED_THIS_EDITION' as const })) },
        },
        select: { id: true },
      })
      recipients += p.recipients.length
      captureServerEvent('system', 'layoff_outreach_queued', {
        noticeId: input.noticeId, employer: input.employer, audience: p.audience, variant: p.variant, editionId: edition.id, recipients: p.recipients.length,
      })
    }
    return { editions: plans.length, recipients, skipped: null }
  } catch (e) {
    console.error('Layoff outreach not queued for', input.employer, e)
    return none('error')
  }
}
