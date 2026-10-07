import 'server-only'
import type { MailingAddedVia, MailingMemberStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { canAddToList, ADD_BLOCKED_MESSAGE, normalizeListEmail } from './rules'
import { suggestListKeys } from './suggest'

export const SETTINGS_DEFAULTS = {
  fromName: 'Justin Kulla',
  fromEmail: 'justin@updates.launchyournextchapter.com',
  replyTo: 'justin@launchyournextchapter.com',
  testEmail: 'justin@launchyournextchapter.com',
  ratePerHour: 50,
  footerText: "Not useful? Reply 'unsubscribe' or [click here] and I'll take you off. NextChapter · {{postalAddress}}",
  postalAddress: '',
}

export async function getMailingSettings() {
  const row = await prisma.mailingSettings.findUnique({ where: { id: 'singleton' } })
  return row ?? { id: 'singleton', ...SETTINGS_DEFAULTS, updatedAt: new Date(0) }
}

export async function activeLists() {
  return prisma.mailingList.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
}

export interface AddResult {
  added: { listId: string; listName: string }[]
  blocked: { listId: string; listName: string; reason: string }[]
}

/**
 * Adds one address to several lists, applying the never-re-add rule to
 * each. Returns what was added and, for anything refused, why — the UI
 * shows those as warnings instead of failing the whole save.
 */
export async function addToLists(input: {
  email: string
  personId: string | null
  listIds: string[]
  addedVia: MailingAddedVia
  consentNote?: string | null
  addedByEmail?: string | null
}): Promise<AddResult> {
  const result: AddResult = { added: [], blocked: [] }
  const email = normalizeListEmail(input.email)
  const lists = await prisma.mailingList.findMany({ where: { id: { in: input.listIds } } })
  if (!email) {
    for (const l of lists) result.blocked.push({ listId: l.id, listName: l.name, reason: 'no valid email address' })
    return result
  }
  const [existing, suppression] = await Promise.all([
    prisma.mailingListMember.findMany({ where: { email, listId: { in: input.listIds } } }),
    prisma.mailingSuppression.findUnique({ where: { email } }),
  ])
  const statusByList = new Map(existing.map((m) => [m.listId, m.status]))
  for (const list of lists) {
    const verdict = canAddToList(statusByList.get(list.id) ?? null, (suppression?.reason as 'BOUNCED' | 'COMPLAINED' | undefined) ?? null)
    if (!verdict.ok) {
      // Already there is not a problem worth warning about, but the person
      // link is worth filling in if it was missing.
      if (verdict.reason === 'already_active' && input.personId) {
        await prisma.mailingListMember.updateMany({ where: { listId: list.id, email, personId: null }, data: { personId: input.personId } })
      }
      if (verdict.reason !== 'already_active') result.blocked.push({ listId: list.id, listName: list.name, reason: ADD_BLOCKED_MESSAGE[verdict.reason] })
      continue
    }
    await prisma.mailingListMember.create({
      data: {
        listId: list.id, email, personId: input.personId, status: 'ACTIVE', addedVia: input.addedVia,
        consentNote: input.consentNote?.trim() || null, addedByEmail: input.addedByEmail ?? null,
      },
    })
    result.added.push({ listId: list.id, listName: list.name })
  }
  return result
}

/** An admin taking someone off a list. Recorded as UNSUBSCRIBED, so it sticks. */
export async function setMemberStatus(listId: string, email: string, status: MailingMemberStatus) {
  await prisma.mailingListMember.updateMany({ where: { listId, email: email.toLowerCase() }, data: { status, statusAt: new Date() } })
}

/**
 * Unsubscribes an address from the given lists (or every list) and logs it
 * on the person's CRM history.
 */
export async function unsubscribe(email: string, listIds: string[] | 'all', via: string): Promise<number> {
  const e = email.toLowerCase()
  const where = { email: e, status: 'ACTIVE' as const, ...(listIds === 'all' ? {} : { listId: { in: listIds } }) }
  const rows = await prisma.mailingListMember.findMany({ where, include: { list: { select: { name: true } } } })
  if (rows.length === 0) return 0
  await prisma.mailingListMember.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { status: 'UNSUBSCRIBED', statusAt: new Date() } })
  // Anyone still waiting for an unsent edition of these lists comes off it too.
  await prisma.mailingEditionRecipient.updateMany({
    where: { email: e, status: 'PENDING', source: 'BASE', edition: { status: { in: ['DRAFT', 'SCHEDULED', 'SENDING'] }, lists: { some: { listId: { in: rows.map((r) => r.listId) } } } } },
    data: { excluded: true, excludedReason: 'unsubscribed' },
  })
  const personId = rows.find((r) => r.personId)?.personId ?? (await personIdForEmail(e))
  if (personId) {
    await prisma.crmActivity.create({
      data: {
        type: 'FIELD_CHANGED', direction: 'INBOUND', personId, isAutoLogged: true,
        subject: `Unsubscribed from ${rows.map((r) => r.list.name).join(', ')}`,
        body: `Via ${via}.`,
      },
    })
  }
  return rows.length
}

/** A hard bounce or a spam complaint: every list, and never again. */
export async function suppress(email: string, reason: 'BOUNCED' | 'COMPLAINED', detail?: string | null) {
  const e = email.toLowerCase()
  const existing = await prisma.mailingSuppression.findUnique({ where: { email: e } })
  // A complaint outranks a bounce; never downgrade.
  if (!existing || (existing.reason === 'BOUNCED' && reason === 'COMPLAINED')) {
    await prisma.mailingSuppression.upsert({
      where: { email: e }, create: { email: e, reason, detail: detail ?? null }, update: { reason, detail: detail ?? null },
    })
  }
  await prisma.mailingListMember.updateMany({
    where: { email: e, status: { in: reason === 'COMPLAINED' ? ['ACTIVE', 'UNSUBSCRIBED', 'BOUNCED'] : ['ACTIVE'] } },
    data: { status: reason, statusAt: new Date() },
  })
  await prisma.mailingEditionRecipient.updateMany({
    where: { email: e, status: 'PENDING' }, data: { excluded: true, excludedReason: 'suppressed' },
  })
}

export async function personIdForEmail(email: string): Promise<string | null> {
  const p = await prisma.crmPerson.findFirst({
    where: { deletedAt: null, OR: [{ email: { equals: email, mode: 'insensitive' } }, { emails: { has: email } }] },
    select: { id: true },
  })
  return p?.id ?? null
}

const WORKFORCE_ORG = /\bworkforce\b|careersource|american job center|job center/i

/** Suggested list keys for each person, from roles, pipelines and orgs. */
export async function suggestionsFor(personIds: string[]): Promise<Map<string, string[]>> {
  const people = await prisma.crmPerson.findMany({
    where: { id: { in: personIds } },
    select: {
      id: true, roles: true,
      opportunities: { where: { stage: { isLost: false } }, select: { pipeline: { select: { key: true } } } },
      affiliations: { where: { isCurrent: true }, select: { org: { select: { name: true, dealStatus: true } } } },
    },
  })
  return new Map(people.map((p) => [p.id, suggestListKeys({
    roles: p.roles,
    pipelineKeys: p.opportunities.map((o) => o.pipeline.key),
    isCustomer: p.affiliations.some((a) => a.org.dealStatus === 'CUSTOMER'),
    isWorkforceBoard: p.affiliations.some((a) => WORKFORCE_ORG.test(a.org.name)),
  })]))
}


/**
 * Raises (or refreshes) the "Add to a mailing list?" card after an email
 * you sent someone. Skipped when they're already on every list that fits,
 * when you said Never, while a snooze runs, or when the address can't be
 * mailed at all.
 */
export async function raiseListPrompt(personId: string, activityId: string, emailedAt: Date): Promise<boolean> {
  const person = await prisma.crmPerson.findUnique({
    where: { id: personId },
    select: { email: true, deletedAt: true, mailingPrompt: true, mailingMemberships: { select: { list: { select: { key: true } } } } },
  })
  const email = normalizeListEmail(person?.email)
  if (!person || person.deletedAt || !email) return false
  const prompt = person.mailingPrompt
  if (prompt?.status === 'NEVER') return false
  if (prompt?.status === 'SNOOZED' && prompt.snoozedUntil && prompt.snoozedUntil > new Date()) return false
  if (await prisma.mailingSuppression.findUnique({ where: { email } })) return false

  const suggested = (await suggestionsFor([personId])).get(personId) ?? ['monthly_update']
  const activeKeys = new Set((await activeLists()).map((l) => l.key))
  const onAny = new Set(person.mailingMemberships.map((m) => m.list.key))
  // Any membership, whatever its status, counts as "already decided" — an
  // unsubscribed list is never suggested again.
  const missing = suggested.filter((k) => activeKeys.has(k) && !onAny.has(k))
  if (missing.length === 0) return false
  if (prompt?.status === 'PENDING' && prompt.lastEmailedAt && prompt.lastEmailedAt >= emailedAt) return true

  await prisma.mailingListPrompt.upsert({
    where: { personId },
    create: { personId, status: 'PENDING', suggestedKeys: missing, lastActivityId: activityId, lastEmailedAt: emailedAt },
    update: { status: 'PENDING', snoozedUntil: null, suggestedKeys: missing, lastActivityId: activityId, lastEmailedAt: emailedAt },
  })
  return true
}

/**
 * Website signups that reached NewsletterSubscriber but not the Monthly
 * Update yet. The signup form writes NewsletterSubscriber; this keeps the
 * list in step (run before every roster build and by the send cron), so
 * nothing about the signup boxes has to change. An unsubscribe recorded
 * there carries over.
 */
export async function syncWebsiteSignups(): Promise<number> {
  const list = await prisma.mailingList.findUnique({ where: { key: 'monthly_update' } })
  if (!list) return 0
  const known = new Set((await prisma.mailingListMember.findMany({ where: { listId: list.id }, select: { email: true } })).map((m) => m.email))
  const subs = await prisma.newsletterSubscriber.findMany({ select: { email: true, source: true, createdAt: true, unsubscribedAt: true } })
  let added = 0
  for (const s of subs) {
    const email = normalizeListEmail(s.email)
    if (!email) continue
    if (known.has(email)) {
      if (s.unsubscribedAt) {
        await prisma.mailingListMember.updateMany({
          where: { listId: list.id, email, status: 'ACTIVE', addedVia: 'WEBSITE_SIGNUP' },
          data: { status: 'UNSUBSCRIBED', statusAt: s.unsubscribedAt },
        })
      }
      continue
    }
    const suppressed = await prisma.mailingSuppression.findUnique({ where: { email } })
    await prisma.mailingListMember.create({
      data: {
        listId: list.id, email, personId: await personIdForEmail(email),
        status: s.unsubscribedAt ? 'UNSUBSCRIBED' : suppressed ? (suppressed.reason as MailingMemberStatus) : 'ACTIVE',
        addedVia: 'WEBSITE_SIGNUP', consentNote: `Signed up on the site (${s.source ?? 'unknown page'})`,
        addedAt: s.createdAt, statusAt: s.unsubscribedAt,
      },
    }).catch(() => {})
    added++
  }
  return added
}
