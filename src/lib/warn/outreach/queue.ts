import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { getMailingSettings } from '@/lib/mailing/lists'
import type { DraftContext } from '@/lib/warn/layoff-alert-drafts'
import type { ContactGroup } from '@/lib/warn/layoff-alert-rules'
import { AUDIENCE_LABEL, CAMPAIGN, CONTACT_COOLDOWN_DAYS, planOutreach } from './plan'
import { addressQuality, needsVerification } from './quality'
import { cleanEmployerName } from './employer-name'
import { ensureVerified } from './verify'
import { loadAddressFacts } from './quality-data'
import type { CopyMode } from './copy'

/** A layoff older than this when its alert finally goes out (a held alert) is not emailed about. */
const MAX_NOTICE_AGE_DAYS = 5

/** Off only when LAYOFF_OUTREACH is set to 0 or off; owner decision 2026-11-13: email about every future layoff alert. */
export const outreachEnabled = () => !/^(0|off|false)$/i.test(process.env.LAYOFF_OUTREACH ?? '')

export interface OutreachResult { editions: number; recipients: number; skipped: string | null }

/** The backfill (src/lib/warn/outreach/backfill.ts) queues older layoffs held as drafts: no age limit, the continued-support wording where it applies, nothing sends. */
export interface QueueOptions { mode?: CopyMode; hold?: boolean }

/**
 * Called once, right after a layoff alert goes to Justin. Makes one edition per audience and note (HR, Rapid Response,
 * workforce board, job center, economic development) with the layoff's contacts as the recipients, and starts it sending: the
 * layoff send window (every day 8 a.m. to noon Eastern; an overnight layoff waits for the morning), hourly rate and daily cap, suppression list and unsubscribe handling all apply,
 * and opens, clicks, replies and unsubscribes are tracked on the edition. Justin is copied (BCC) on each send.
 * Reads: one notice, one settings row, up to ~14 addresses against the suppression table and last week's outreach.
 * Never throws; a failure here must not undo the alert.
 */
export async function queueLayoffOutreach(input: { noticeId: string; employer: string; groups: ContactGroup[]; ctx: DraftContext; opts?: QueueOptions }): Promise<OutreachResult> {
  const none = (skipped: string): OutreachResult => ({ editions: 0, recipients: 0, skipped })
  try {
    if (!outreachEnabled()) return none('switched off')
    const notice = await prisma.warnNotice.findUnique({ where: { id: input.noticeId }, select: { fetchedAt: true, dismissedAt: true } })
    if (!notice || notice.dismissedAt) return none('notice dismissed or missing')
    if (!input.opts?.hold && Date.now() - notice.fetchedAt.getTime() > MAX_NOTICE_AGE_DAYS * 86_400_000) return none('notice too old')
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
    // Only addresses most likely to be real and deliverable (quality.ts): the sending domain must not be spam filtered.
    const items = input.groups.flatMap((g) => g.cards.map((c) => ({ email: c.email ?? '', personId: c.personId })))
    let facts = await loadAddressFacts(items)
    // An address nothing has checked recently (a directory contact, a contact Hunter never looked at) is checked with Hunter, one credit each, and
    // emailed only if Hunter calls it deliverable. A layoff whose addresses could not all be checked this time is tried again, not given up on.
    const toCheck = [...facts.values()].filter((f) => needsVerification(f)).map((f) => f.email)
    let waiting = 0
    if (toCheck.length) {
      const v = await ensureVerified(toCheck, { max: 40, timeMs: 60_000 })
      if (v.checked) facts = await loadAddressFacts(items)
      waiting = [...facts.values()].filter((f) => needsVerification(f)).length
    }
    const screened: Record<string, number> = {}
    for (const [email, f] of facts) {
      const q = addressQuality(f)
      if (!q.ok) { blocked.add(email); screened[q.reason ?? 'screened'] = (screened[q.reason ?? 'screened'] ?? 0) + 1 }
    }
    if (Object.keys(screened).length) captureServerEvent('system', 'layoff_outreach_screened', { noticeId: input.noticeId, employer: input.employer, held: !!input.opts?.hold, ...screened })
    const own = new Set([settings.testEmail, settings.replyTo, 'justin@launchyournextchapter.com'].map((e) => e.toLowerCase()))

    // The employer's name as a person writes it (no filing street address, no plant name) in every subject and body.
    const ctx = { ...input.ctx, picture: { ...input.ctx.picture, employer: cleanEmployerName(input.ctx.picture.employer) } }
    const plans = planOutreach(input.groups, ctx, { blocked, ownAddresses: own, noticeId: input.noticeId, mode: input.opts?.mode })
    if (plans.length === 0) return none(waiting > 0 ? 'waiting for address verification' : 'no contact with a verified address')

    const bcc = settings.testEmail
    let recipients = 0
    for (const [i, p] of plans.entries()) {
      const key = `lo-${input.noticeId}-${p.audience}-${i + 1}`
      const edition = await prisma.mailingEdition.create({
        data: {
          key,
          title: `${input.employer} · ${AUDIENCE_LABEL[p.audience]}${p.variant ? ` · version ${p.variant}` : ''}`,
          subject: p.subject,
          bodyHtml: p.bodyHtml,
          status: input.opts?.hold ? 'DRAFT' : 'SENDING',
          sendStartedAt: input.opts?.hold ? null : new Date(),
          createdByEmail: input.opts?.hold ? 'layoff-backfill' : 'layoff-outreach',
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
        noticeId: input.noticeId, employer: input.employer, audience: p.audience, variant: p.variant, editionId: edition.id, recipients: p.recipients.length, held: !!input.opts?.hold, mode: input.opts?.mode ?? 'new',
      })
    }
    return { editions: plans.length, recipients, skipped: null }
  } catch (e) {
    console.error('Layoff outreach not queued for', input.employer, e)
    return none('error')
  }
}
