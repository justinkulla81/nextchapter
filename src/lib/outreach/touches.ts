import 'server-only'
import type { CrmActivityType, CrmPersonRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { loadSentEmails, type SentSource } from '@/lib/crm/sent-emails'
import { CAMPAIGNS } from './report'
import { isPersonalOnly, personGroupOf } from './person-groups'
import type { Touch, TouchChannel } from './touch-stats'

/** How far back the Outreach page can look. */
export const LOOKBACK_DAYS = 365
const RESPONSE_WINDOW_MS = 14 * 86_400_000

/** Emails go out automated (scripted cold outreach, mailing lists) or by hand (composed in the CRM, sent from Gmail). */
const EMAIL_MODE: Record<SentSource, 'automated' | 'manual'> = { cold: 'automated', mailing: 'automated', crm: 'manual', gmail: 'manual' }
const EMAIL_SOURCE: Record<SentSource, string> = { cold: 'Cold outreach (automated)', mailing: 'Mailing lists (automated)', crm: 'Email composed in CRM', gmail: 'Email sent from Gmail' }

const MANUAL_TYPES: CrmActivityType[] = ['CALL', 'LINKEDIN_MESSAGE', 'LINKEDIN_CONNECT', 'NOTE']

/** A call or message logged for an earlier day with no time is dated midday (noon UTC from the old call form, 16:00 UTC from the quick log); its hour means nothing. */
export function hasRealTime(at: Date): boolean {
  const atNoon = at.getUTCMinutes() === 0 && at.getUTCSeconds() === 0 && at.getUTCMilliseconds() === 0
  return !(atNoon && (at.getUTCHours() === 12 || at.getUTCHours() === 16))
}

function manualChannel(type: CrmActivityType, subject: string | null): { channel: TouchChannel; source: string } | null {
  if (type === 'CALL') return { channel: 'call', source: 'Phone call' }
  if (type === 'LINKEDIN_MESSAGE' || type === 'LINKEDIN_CONNECT') return { channel: 'linkedin', source: 'LinkedIn' }
  if (type === 'NOTE' && /^Contacted by text/i.test(subject ?? '')) return { channel: 'text', source: 'Text message' }
  return null
}

async function rolesFor(ids: string[]): Promise<Map<string, CrmPersonRole[]>> {
  const out = new Map<string, CrmPersonRole[]>()
  for (let i = 0; i < ids.length; i += 5000) {
    const rows = await prisma.crmPerson.findMany({ where: { id: { in: ids.slice(i, i + 5000) } }, select: { id: true, roles: true } })
    for (const r of rows) out.set(r.id, r.roles)
  }
  return out
}

/** Every outreach touch in the last year, automated and by hand, one per email, call, LinkedIn message or text, with who it went to and whether they responded. */
export async function loadTouches(): Promise<{ touches: Touch[]; capped: boolean }> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000)
  const [{ rows: emails, capped }, acts] = await Promise.all([
    loadSentEmails(),
    prisma.crmActivity.findMany({
      where: { type: { in: MANUAL_TYPES }, direction: 'OUTBOUND', needsReview: false, personId: { not: null }, occurredAt: { gte: since } },
      select: { type: true, subject: true, outcome: true, occurredAt: true, personId: true },
      orderBy: { occurredAt: 'desc' },
      take: 20_000,
    }),
  ])

  const manual = acts.flatMap((a) => { const m = manualChannel(a.type, a.subject); return m ? [{ ...a, ...m }] : [] })
  const personIds = [...new Set([...emails.map((e) => e.personId), ...manual.map((m) => m.personId)].filter((x): x is string => !!x))]

  // A reply to a LinkedIn message or a text is anything they send back (not email, which is read from the thread) within two weeks.
  const manualPeople = [...new Set(manual.filter((m) => m.channel !== 'call').map((m) => m.personId!))]
  const [roles, inbound] = await Promise.all([
    rolesFor(personIds),
    manualPeople.length
      ? prisma.crmActivity.findMany({
          where: { personId: { in: manualPeople }, direction: 'INBOUND', type: { not: 'EMAIL' }, occurredAt: { gte: since } },
          select: { personId: true, occurredAt: true },
        })
      : Promise.resolve([]),
  ])
  const inboundBy = new Map<string, Date[]>()
  for (const i of inbound) inboundBy.set(i.personId!, [...(inboundBy.get(i.personId!) ?? []), i.occurredAt])

  const touches: Touch[] = []
  const campaignAudience = new Map(CAMPAIGNS.map((c) => [c.slug, c.audience]))

  for (const e of emails) {
    if (e.sentAt < since) continue
    const r = e.personId ? (roles.get(e.personId) ?? []) : []
    if (isPersonalOnly(r)) continue
    touches.push({
      at: e.sentAt, channel: 'email', mode: EMAIL_MODE[e.source], source: EMAIL_SOURCE[e.source],
      group: personGroupOf(r, e.campaign ? campaignAudience.get(e.campaign.slug) : null),
      personId: e.personId, responded: !!e.repliedAt, positive: e.replyClass === 'positive' || e.replyClass === 'referral', hasTime: true,
    })
  }

  for (const m of manual) {
    const r = roles.get(m.personId!) ?? []
    if (isPersonalOnly(r)) continue
    const responded = m.channel === 'call'
      ? /^Connected/i.test(m.outcome ?? '')
      : (inboundBy.get(m.personId!) ?? []).some((d) => d > m.occurredAt && d.getTime() - m.occurredAt.getTime() <= RESPONSE_WINDOW_MS)
    touches.push({
      at: m.occurredAt, channel: m.channel, mode: 'manual', source: m.source, group: personGroupOf(r),
      personId: m.personId, responded, positive: false, hasTime: hasRealTime(m.occurredAt),
    })
  }

  touches.sort((a, b) => b.at.getTime() - a.at.getTime())
  return { touches, capped: capped.length > 0 }
}
