import 'server-only'
import { prisma } from '@/lib/prisma'
import { humanOpens } from '@/lib/outreach/event-rules'
import { replyClassOf, type ReplyClass } from '@/lib/outreach/reply-class'
import { CAMPAIGNS } from '@/lib/outreach/report'
import { threadKey } from './email-thread'

/** Where a sent email came from. 'cold' = scripted cold outreach, 'crm' = composed in the CRM with tracking, 'gmail' = sent from Gmail and synced in, 'mailing' = a mailing-list edition. */
export type SentSource = 'cold' | 'crm' | 'gmail' | 'mailing'
export const SOURCE_LABEL: Record<SentSource, string> = { cold: 'Cold outreach', crm: 'Composed in CRM', gmail: 'Sent from Gmail', mailing: 'Mailing list' }

const REPLY_WINDOW_MS = 14 * 86_400_000
/** Most recent rows loaded per source; the page says so when a source hits it. */
export const SOURCE_CAP = 5000

export interface SentEmailRow {
  key: string
  source: SentSource
  sentAt: Date
  subject: string
  /** Why it was sent, in plain words. */
  purpose: string
  personId: string | null
  name: string
  email: string
  orgId: string | null
  orgName: string
  lists: { id: string; name: string }[]
  edition: { id: string; title: string } | null
  /** False when this kind of send has no open/click tracking (Gmail-synced mail), so "0" would mislead. */
  tracked: boolean
  opens: number
  /** Cold outreach only: an open event arrived but within two minutes of the send, which is a mail scanner, not a person. */
  scannerOpenOnly: boolean
  clicks: number
  repliedAt: Date | null
  replyClass: ReplyClass | null
  bounced: boolean
  failed: boolean
  externalUrl: string | null
}

export interface SentEmailTotals { sent: number; tracked: number; opened: number; clicked: number; replied: number; positive: number; bounced: number }

const personSelect = { id: true, fullName: true, email: true, affiliations: { where: { isCurrent: true }, select: { org: { select: { id: true, name: true } } }, take: 1 } } as const

function coldPurpose(outcome: string | null): string {
  const step = /email (\d)/.exec(outcome ?? '')?.[1] ?? '1'
  const template = /template (\S+?)(,|$)/.exec(outcome ?? '')?.[1] ?? ''
  const audience = CAMPAIGNS.find((c) => c.templates.includes(template))?.audience
  const what = audience ? `Cold outreach: ${audience}` : 'Cold outreach'
  return Number(step) > 1 ? `${what} (follow-up ${Number(step) - 1})` : what
}

/** Every email we have sent, from all four sources, newest first, with opens, clicks and replies worked out per email. */
export async function loadSentEmails(): Promise<{ rows: SentEmailRow[]; capped: SentSource[] }> {
  const [acts, recips, lists] = await Promise.all([
    prisma.crmActivity.findMany({
      where: { type: 'EMAIL', direction: 'OUTBOUND', needsReview: false },
      select: {
        id: true, occurredAt: true, subject: true, outcome: true, sourceRef: true, threadId: true, isAutoLogged: true,
        person: { select: personSelect },
        outreachTracking: { select: { openCount: true, links: { select: { clickCount: true } } } },
      },
      orderBy: { occurredAt: 'desc' },
      take: SOURCE_CAP,
    }),
    prisma.mailingEditionRecipient.findMany({
      where: { sentAt: { not: null } },
      select: {
        id: true, email: true, sentAt: true, status: true, fromListKeys: true, resendEmailId: true,
        openCount: true, clickCount: true, repliedAt: true, bouncedAt: true,
        edition: { select: { id: true, title: true, subject: true, isReport: true, lists: { select: { list: { select: { id: true, name: true } } } } } },
        person: { select: personSelect },
      },
      orderBy: { sentAt: 'desc' },
      take: SOURCE_CAP,
    }),
    prisma.mailingList.findMany({ select: { id: true, key: true, name: true } }),
  ])

  const personIds = [...new Set(acts.map((a) => a.person?.id).filter((x): x is string => !!x))]
  const inbound = personIds.length
    ? await prisma.crmActivity.findMany({
        where: { type: 'EMAIL', direction: 'INBOUND', personId: { in: personIds } },
        select: { personId: true, occurredAt: true, threadId: true, subject: true, outcome: true },
        orderBy: { occurredAt: 'asc' },
      })
    : []
  const inboundBy = new Map<string, typeof inbound>()
  for (const i of inbound) inboundBy.set(i.personId!, [...(inboundBy.get(i.personId!) ?? []), i])
  const listByKey = new Map(lists.map((l) => [l.key, l]))

  const rows: SentEmailRow[] = []

  for (const a of acts) {
    const cold = (a.outcome ?? '').startsWith('Cold outreach')
    const composed = !!a.outreachTracking
    const source: SentSource = cold ? 'cold' : composed ? 'crm' : 'gmail'
    const org = a.person?.affiliations[0]?.org
    const subjKey = threadKey(a.subject)

    // A reply is the person's next inbound email after this one: same Gmail thread or subject, or (cold outreach, which goes out by Resend and has no thread) anything within two weeks.
    let repliedAt: Date | null = null
    let replyClass: ReplyClass | null = null
    for (const i of inboundBy.get(a.person?.id ?? '') ?? []) {
      if (i.occurredAt <= a.occurredAt) continue
      const sameThread = (a.threadId && i.threadId === a.threadId) || (!!subjKey && threadKey(i.subject) === subjKey)
      const inWindow = cold && i.occurredAt.getTime() - a.occurredAt.getTime() <= REPLY_WINDOW_MS
      if (!sameThread && !inWindow) continue
      const c = replyClassOf(i.outcome)
      if (c === 'auto') continue // an out-of-office is not a person replying
      if (!repliedAt) { repliedAt = i.occurredAt; replyClass = c ?? 'other' } else if (c === 'positive') replyClass = 'positive'
    }

    const ref = a.threadId ?? a.sourceRef
    rows.push({
      key: `a:${a.id}`, source, sentAt: a.occurredAt, subject: a.subject ?? '(no subject)',
      purpose: cold ? coldPurpose(a.outcome) : composed ? 'One-to-one email from the CRM' : a.isAutoLogged ? 'One-to-one email (from Gmail)' : 'One-to-one email',
      personId: a.person?.id ?? null, name: a.person?.fullName ?? 'Unmatched recipient', email: a.person?.email ?? '',
      orgId: org?.id ?? null, orgName: org?.name ?? '', lists: [], edition: null,
      tracked: cold || composed,
      scannerOpenOnly: cold && humanOpens(a.outcome) === 0 && /, opened(,|$)/.test(a.outcome ?? ''),
      opens: cold ? humanOpens(a.outcome) : (a.outreachTracking?.openCount ?? 0),
      clicks: cold ? (/, clicked(,|$)/.test(a.outcome ?? '') ? 1 : 0) : (a.outreachTracking?.links.reduce((n, l) => n + l.clickCount, 0) ?? 0),
      repliedAt, replyClass, bounced: /, bounced/.test(a.outcome ?? ''), failed: false,
      externalUrl: ref ? (ref.startsWith('resend:') ? `https://resend.com/emails/${ref.slice(7)}` : `https://mail.google.com/mail/u/0/#all/${ref}`) : null,
    })
  }

  for (const r of recips) {
    const org = r.person?.affiliations[0]?.org
    const fromKeys = r.fromListKeys.map((k) => listByKey.get(k)).filter((l): l is NonNullable<typeof l> => !!l)
    const editionLists = r.edition.lists.map((l) => l.list)
    rows.push({
      key: `m:${r.id}`, source: 'mailing', sentAt: r.sentAt!, subject: r.edition.subject || r.edition.title,
      purpose: r.edition.isReport ? `Report: ${r.edition.title}` : `Mailing: ${r.edition.title}`,
      personId: r.person?.id ?? null, name: r.person?.fullName ?? r.email, email: r.email,
      orgId: org?.id ?? null, orgName: org?.name ?? '',
      lists: (fromKeys.length ? fromKeys : editionLists).map((l) => ({ id: l.id, name: l.name })),
      edition: { id: r.edition.id, title: r.edition.title },
      tracked: true, opens: r.openCount, scannerOpenOnly: false, clicks: r.clickCount,
      repliedAt: r.repliedAt, replyClass: r.repliedAt ? 'other' : null,
      bounced: !!r.bouncedAt, failed: r.status === 'FAILED',
      externalUrl: r.resendEmailId ? `https://resend.com/emails/${r.resendEmailId}` : null,
    })
  }

  rows.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
  const capped: SentSource[] = []
  if (acts.length >= SOURCE_CAP) capped.push('cold', 'crm', 'gmail')
  if (recips.length >= SOURCE_CAP) capped.push('mailing')
  return { rows, capped }
}

export function totalsOf(rows: SentEmailRow[]): SentEmailTotals {
  const tracked = rows.filter((r) => r.tracked)
  return {
    sent: rows.length,
    tracked: tracked.length,
    opened: tracked.filter((r) => r.opens > 0).length,
    clicked: tracked.filter((r) => r.clicks > 0).length,
    replied: rows.filter((r) => r.repliedAt).length,
    positive: rows.filter((r) => r.replyClass === 'positive' || r.replyClass === 'referral').length,
    bounced: rows.filter((r) => r.bounced).length,
  }
}
