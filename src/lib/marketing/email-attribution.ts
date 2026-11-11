import { prisma } from '@/lib/prisma'

// A tracked outbound email link (/api/crm/outreach/click/<linkId>) redirects to the real page. For a page on our own
// site the redirect adds utm_source=email and nc_e=<linkId>, so the visit that follows can be traced back to the
// person the email went to. The link id is an opaque cuid; no name or address ever appears in the URL.
export const EMAIL_VISIT_PARAM = 'nc_e'

const OWN_HOSTS = new Set(['launchyournextchapter.com', 'www.launchyournextchapter.com'])

function isOwnSite(url: URL): boolean {
  if (OWN_HOSTS.has(url.hostname.toLowerCase())) return true
  try {
    const app = process.env.NEXT_PUBLIC_APP_URL
    return !!app && new URL(app).hostname.toLowerCase() === url.hostname.toLowerCase()
  } catch {
    return false
  }
}

/** The destination with the email tags added. Other sites and unparseable URLs come back unchanged. An existing utm_source is kept. */
export function withEmailAttribution(destination: string, linkId: string): string {
  let url: URL
  try {
    url = new URL(destination)
  } catch {
    return destination
  }
  if (!/^https?:$/.test(url.protocol) || !isOwnSite(url)) return destination
  if (!url.searchParams.has('utm_source')) {
    url.searchParams.set('utm_source', 'email')
    url.searchParams.set('utm_medium', 'outreach')
  }
  url.searchParams.set(EMAIL_VISIT_PARAM, linkId)
  return url.toString()
}

/** The email link id on a stored landing path, or null. */
export function extractEmailLinkId(path: string | null): string | null {
  if (!path) return null
  const q = path.indexOf('?')
  if (q === -1) return null
  const id = new URLSearchParams(path.slice(q + 1).split('#')[0]).get(EMAIL_VISIT_PARAM)
  return id && /^[a-z0-9]{10,40}$/i.test(id) ? id : null
}

export interface EmailRecipient {
  personId: string
  name: string
  email: string | null
  subject: string | null
  /** Where they work now (their primary current CRM affiliation), or null when the CRM has none. */
  orgName: string | null
  title: string | null
  /** When the tracked link was created, which is when the email went out. Only set for a tracked outreach link. */
  emailedAt?: Date | null
}

/** Link id -> the CRM person the email went to. Ids that match nothing are left out. */
export async function resolveEmailRecipients(linkIds: string[]): Promise<Map<string, EmailRecipient>> {
  const ids = Array.from(new Set(linkIds))
  if (ids.length === 0) return new Map()
  const links = await prisma.crmOutreachLink.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      createdAt: true,
      tracking: { select: { activity: { select: { subject: true, person: {
        select: {
          id: true,
          fullName: true,
          email: true,
          affiliations: {
            where: { isCurrent: true },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
            take: 1,
            select: { title: true, org: { select: { name: true } } },
          },
        },
      } } } } },
    },
  })
  const out = new Map<string, EmailRecipient>()
  for (const l of links) {
    const person = l.tracking.activity.person
    if (!person) continue
    const job = person.affiliations[0]
    out.set(l.id, {
      personId: person.id,
      name: person.fullName,
      email: person.email,
      subject: l.tracking.activity.subject,
      orgName: job?.org.name ?? null,
      title: job?.title ?? null,
      emailedAt: l.createdAt,
    })
  }
  return out
}

// Second, weaker signal: a later visit from the same IP as a tagged email visit is probably the same person. Never
// used when the visit carries its own nc_e, and dropped when the IP has tagged visits from more than one person
// (shared office network, VPN) — a wrong name is worse than none.
export const IP_MATCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export interface IpVisit {
  ip: string | null
  path: string | null
  createdAt: Date
}

export type EmailIpAnchors = Map<string, { linkId: string; at: Date }[]>

/** The tagged (nc_e) visits, grouped by IP and sorted oldest first. Callers pass human, non-datacenter visits only. */
export function buildEmailIpAnchors(visits: IpVisit[]): EmailIpAnchors {
  const anchors: EmailIpAnchors = new Map()
  for (const v of visits) {
    const linkId = extractEmailLinkId(v.path)
    if (!linkId || !v.ip) continue
    anchors.set(v.ip, [...(anchors.get(v.ip) ?? []), { linkId, at: v.createdAt }])
  }
  for (const list of anchors.values()) list.sort((a, b) => a.at.getTime() - b.at.getTime())
  return anchors
}

/** The link id of the one person this visit probably belongs to, or null. */
export function inferEmailLinkByIp(
  visit: IpVisit,
  anchors: EmailIpAnchors,
  personIdOfLink: (linkId: string) => string | undefined
): string | null {
  if (!visit.ip || extractEmailLinkId(visit.path)) return null
  const at = visit.createdAt.getTime()
  const nearby = (anchors.get(visit.ip) ?? []).filter((a) => a.at.getTime() <= at && at - a.at.getTime() <= IP_MATCH_WINDOW_MS)
  const people = new Set<string>()
  for (const a of nearby) {
    const person = personIdOfLink(a.linkId)
    if (person) people.add(person)
  }
  if (people.size !== 1) return null
  return nearby[nearby.length - 1].linkId
}

// ── Mailing-list emails (the monthly report, the newsletter) ─────────────────────────────────────────────────────────
// These links carry no nc_e tag, but every one has an unsubscribe link whose token starts with the recipient's address
// encoded in base64. Match that prefix against the people the edition was sent to. A prefix that fits more than one
// recipient is not used: a wrong name is worse than none.
//
// Known limit, as of 2026-11-11: a person who follows the link leaves the whole token in the log (the address, the edition
// and the signature, about 115 characters), which names exactly one recipient. A mail scanner requests a mangled address
// instead: the first 10 characters of the token's base64, which fits one recipient in most cases and several in about 1 in
// 8. Those rows come from scanner addresses, so the log hides them and never names them; the ambiguous ones show as "One of:
// A, B" only with all traffic shown. The mangling is on the scanner's side, not in our tracker, which stores the address
// exactly as the browser reports it.
const UNSUBSCRIBE_PATH = /^\/updates\/unsubscribe\/([A-Za-z0-9_-]{6,})/

/** The unsubscribe token (or its stored prefix) on a landing path, or null. */
export function extractUnsubscribeToken(path: string | null): string | null {
  const m = path ? UNSUBSCRIBE_PATH.exec(path) : null
  return m ? m[1] : null
}

const b64url = (s: string) => Buffer.from(s, 'utf-8').toString('base64url')

/** True when the token (or stored prefix of it) is the start of this address's encoded form, once or twice encoded. */
export function unsubscribeTokenFitsEmail(token: string, email: string): boolean {
  const once = b64url(email.toLowerCase())
  return once.startsWith(token) || b64url(once).startsWith(token)
}

export const MAILING_MATCH_WINDOW_DAYS = 21

export interface MailingMatches {
  /** Token -> the one person it belongs to. */
  unique: Map<string, EmailRecipient>
  /** Token -> the few people it could belong to (more than one, at most MAX_CANDIDATES), when it cannot be narrowed to one. */
  ambiguous: Map<string, EmailRecipient[]>
}

export const MAX_CANDIDATES = 4

/** Unsubscribe tokens -> the person each belongs to among recent edition recipients, or the short list it could be. */
export async function resolveMailingRecipients(tokens: string[], now = new Date()): Promise<MailingMatches> {
  const wanted = Array.from(new Set(tokens))
  const none: MailingMatches = { unique: new Map(), ambiguous: new Map() }
  if (wanted.length === 0) return none
  // About a thousand rows in three weeks; only two narrow columns are read.
  const recent = await prisma.mailingEditionRecipient.findMany({
    where: { sentAt: { gte: new Date(now.getTime() - MAILING_MATCH_WINDOW_DAYS * 86_400_000) }, personId: { not: null } },
    select: { email: true, personId: true },
    take: 20000,
  })
  const peopleByToken = new Map<string, string[]>()
  for (const token of wanted) {
    const ids = new Set<string>()
    for (const r of recent) if (r.personId && unsubscribeTokenFitsEmail(token, r.email)) ids.add(r.personId)
    if (ids.size > 0 && ids.size <= MAX_CANDIDATES) peopleByToken.set(token, Array.from(ids))
  }
  const allIds = Array.from(new Set(Array.from(peopleByToken.values()).flat()))
  if (allIds.length === 0) return none
  const byId = await loadRecipientsByPersonId(allIds)
  const out: MailingMatches = { unique: new Map(), ambiguous: new Map() }
  for (const [token, ids] of peopleByToken) {
    const found = ids.map((id) => byId.get(id)).filter((r): r is EmailRecipient => !!r)
    if (found.length === 1) out.unique.set(token, found[0])
    else if (found.length > 1) out.ambiguous.set(token, found)
  }
  return out
}

/** CRM person id -> name, address and current title and organization, for the people a visit is matched to. */
export async function loadRecipientsByPersonId(ids: string[]): Promise<Map<string, EmailRecipient>> {
  if (ids.length === 0) return new Map()
  const people = await prisma.crmPerson.findMany({
    where: { id: { in: Array.from(new Set(ids)) } },
    select: {
      id: true,
      fullName: true,
      email: true,
      affiliations: { where: { isCurrent: true }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }], take: 1, select: { title: true, org: { select: { name: true } } } },
    },
  })
  return new Map(
    people.map((p) => {
      const job = p.affiliations[0]
      return [p.id, { personId: p.id, name: p.fullName, email: p.email, subject: null, orgName: job?.org.name ?? null, title: job?.title ?? null }] as const
    })
  )
}

/** A scanner opens an email's links within a second or two of each other, then moves to the next recipient. */
export const MAILING_IP_WINDOW_MS = 5 * 1000

export interface MailingAnchor {
  ip: string | null
  token: string
  at: Date
}

/**
 * The token of the person this visit probably belongs to: same IP, and the nearest in time of the unsubscribe-link visits
 * within five seconds. When two people are both close, the nearest wins only if it is at least three times closer.
 */
export function inferMailingTokenByIp(
  visit: { ip: string | null; createdAt: Date },
  anchors: MailingAnchor[],
  personIdOfToken: (token: string) => string | undefined
): string | null {
  if (!visit.ip) return null
  const best = new Map<string, { token: string; gap: number }>()
  for (const a of anchors) {
    if (a.ip !== visit.ip) continue
    const gap = Math.abs(a.at.getTime() - visit.createdAt.getTime())
    const person = personIdOfToken(a.token)
    if (gap > MAILING_IP_WINDOW_MS || !person) continue
    const prior = best.get(person)
    if (!prior || gap < prior.gap) best.set(person, { token: a.token, gap })
  }
  const ranked = Array.from(best.values()).sort((x, y) => x.gap - y.gap)
  if (ranked.length === 0) return null
  if (ranked.length === 1) return ranked[0].token
  return ranked[0].gap * 3 <= ranked[1].gap ? ranked[0].token : null
}

// ── Clicks Resend recorded ────────────────────────────────────────────────────────────────────────────────────────────
// A person's click on a list-email link comes from their own network; the visit to our site that follows comes from the
// same address. That is the direct link between "we emailed them, they clicked" and "this visitor".
export const CLICK_TO_VISIT_WINDOW_MS = 10 * 60 * 1000
// Resend stamps a click when its event arrives, so our own log of the visit that click caused is often seconds, sometimes
// a minute or two, earlier than the click (seen 2026-11-11: visits 3s to 90s before the click, same IP).
export const CLICK_LEAD_WINDOW_MS = 3 * 60 * 1000

export interface MailingClick {
  ip: string | null
  at: Date
  personId: string
}

/** The person whose click, from this visit's own IP within ten minutes before it (or up to three minutes after it: Resend logs late), is the nearest; null when two people tie. */
export function inferPersonByClickIp(visit: { ip: string | null; createdAt: Date }, clicks: MailingClick[]): string | null {
  if (!visit.ip) return null
  const best = new Map<string, number>()
  for (const c of clicks) {
    if (c.ip !== visit.ip) continue
    const gap = visit.createdAt.getTime() - c.at.getTime()
    if (gap < -CLICK_LEAD_WINDOW_MS || gap > CLICK_TO_VISIT_WINDOW_MS) continue
    const dist = Math.abs(gap)
    const prior = best.get(c.personId)
    if (prior === undefined || dist < prior) best.set(c.personId, dist)
  }
  const ranked = Array.from(best.entries()).sort((x, y) => x[1] - y[1])
  if (ranked.length === 0) return null
  if (ranked.length === 1) return ranked[0][0]
  return ranked[0][1] * 3 <= ranked[1][1] ? ranked[0][0] : null
}

// ── Opens and clicks by time alone ────────────────────────────────────────────────────────────────────────────────────
// Gmail's and Apple's image proxies hide the reader's address, so a human open or click often shares no IP with the visit it
// leads to. What is left is time: the people who opened or clicked just before an otherwise unnamed human visit.
export const TOUCH_TO_VISIT_WINDOW_MS = 15 * 60 * 1000
export const TOUCH_LEAD_WINDOW_MS = 60 * 1000

/** Distinct people with a human open or click within fifteen minutes before the visit (or a minute after: events arrive late). */
export function peopleWhoTouchedBefore(visitAt: Date, touches: { at: Date; personId: string }[]): string[] {
  const out = new Set<string>()
  for (const t of touches) {
    const gap = visitAt.getTime() - t.at.getTime()
    if (gap >= -TOUCH_LEAD_WINDOW_MS && gap <= TOUCH_TO_VISIT_WINDOW_MS) out.add(t.personId)
  }
  return Array.from(out)
}

// A tracked link in an email is followed by the recipient's mail security (or the person), which loads our page from another
// address a few seconds later or earlier than Resend stamps the click. Same page, a few seconds apart: that click's recipient.
export const NEAR_CLICK_WINDOW_MS = 20 * 1000

const pathOf = (u: string | null | undefined): string | null => {
  if (!u) return null
  try {
    return new URL(u, 'https://x.invalid').pathname.replace(/\/$/, '')
  } catch {
    return null
  }
}

/** People whose emailed link to this page was clicked within twenty seconds of the visit: the one clearly nearest, else up to three. */
export function peopleByNearClick(visit: { createdAt: Date; path: string | null }, clicks: { at: Date; personId: string; link: string }[]): string[] {
  const page = pathOf(visit.path)
  if (!page) return []
  const best = new Map<string, number>()
  for (const c of clicks) {
    const gap = Math.abs(visit.createdAt.getTime() - c.at.getTime())
    if (gap > NEAR_CLICK_WINDOW_MS || pathOf(c.link) !== page) continue
    const prior = best.get(c.personId)
    if (prior === undefined || gap < prior) best.set(c.personId, gap)
  }
  const ranked = Array.from(best.entries()).sort((x, y) => x[1] - y[1])
  if (ranked.length <= 1) return ranked.map(([id]) => id)
  if (ranked[0][1] * 3 <= ranked[1][1]) return [ranked[0][0]]
  return ranked.length <= 3 ? ranked.map(([id]) => id) : []
}

// ── Per-recipient tag on list-email links ─────────────────────────────────────────────────────────────────────────────
// A list email (the report, the newsletter) is sent one message per recipient. Every link to our own site in it carries
// nc_m=<the recipient's row id in that edition>, an opaque cuid with no name or address, so the visit that follows names
// its recipient even when the click comes from a mail gateway's address. The unsubscribe link already names its owner and
// is left alone.
export const MAILING_VISIT_PARAM = 'nc_m'

/** The mailing recipient id on a stored landing path, or null. */
export function extractMailingRecipientId(path: string | null): string | null {
  if (!path) return null
  const q = path.indexOf('?')
  if (q === -1) return null
  const id = new URLSearchParams(path.slice(q + 1).split('#')[0]).get(MAILING_VISIT_PARAM)
  return id && /^[a-z0-9]{10,40}$/i.test(id) ? id : null
}

function tagUrl(raw: string, recipientId: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return raw
  }
  if (!/^https?:$/.test(url.protocol) || !isOwnSite(url)) return raw
  if (url.pathname.startsWith('/updates/unsubscribe') || url.pathname.startsWith('/api/')) return raw
  if (!url.searchParams.has('utm_source')) {
    url.searchParams.set('utm_source', 'email')
    url.searchParams.set('utm_medium', 'newsletter')
  }
  url.searchParams.set(MAILING_VISIT_PARAM, recipientId)
  return url.toString()
}

/** Adds the recipient tag to every own-site link in a rendered email: href attributes in HTML, bare addresses in plain text. */
export function tagMailingLinks(content: string, recipientId: string, kind: 'html' | 'text'): string {
  if (!/^[a-z0-9]{10,40}$/i.test(recipientId)) return content
  if (kind === 'html') {
    return content.replace(/href="(https?:\/\/[^"]+)"/g, (_m, href: string) => `href="${tagUrl(href.replace(/&amp;/g, '&'), recipientId).replace(/&/g, '&amp;')}"`)
  }
  return content.replace(/https?:\/\/[^\s<>"')]+/g, (u) => tagUrl(u, recipientId))
}

/** Mailing recipient id -> the CRM person that row was sent to. Ids that match nothing, or have no person, are left out. */
export async function resolveMailingRecipientIds(ids: string[]): Promise<Map<string, EmailRecipient>> {
  const wanted = Array.from(new Set(ids))
  if (wanted.length === 0) return new Map()
  const rows = await prisma.mailingEditionRecipient.findMany({ where: { id: { in: wanted }, personId: { not: null } }, select: { id: true, personId: true } })
  const people = await loadRecipientsByPersonId(rows.flatMap((r) => (r.personId ? [r.personId] : [])))
  const out = new Map<string, EmailRecipient>()
  for (const r of rows) {
    const person = r.personId ? people.get(r.personId) : undefined
    if (person) out.set(r.id, person)
  }
  return out
}
