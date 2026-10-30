import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeListEmail } from './rules'
import { suggestionsFor, suppress } from './lists'

/**
 * Subscribes CRM people to the mailing lists that fit their type.
 *
 * Only ever creates a missing membership. It never touches a person who is
 * already on, was unsubscribed from, complained about or bounced off a list,
 * and never adds anyone with a suppression (including Do not email).
 * The Newsletter (monthly_update) and Investor updates are never auto-filled: they stay opt-in / by hand.
 * Addresses Hunter calls invalid, undeliverable or risky are not added. Each run first cleans up (see pruneLists).
 */
export interface AutoAssignResult {
  scanned: number
  added: Record<string, number>
  noEmail: number
  /** Fit a list but Hunter says the address is invalid or risky. */
  held: number
  /** Have an email but their type fits no list. */
  unassigned: { id: string; name: string; email: string; roles: string[] }[]
}

const CHUNK = 400
/** Never filled from a contact type. */
const MANUAL_ONLY = new Set(['monthly_update', 'investors'])
/** Hunter verdicts that keep an address off the auto-filled lists. */
const HELD_BACK = new Set(['invalid', 'undeliverable', 'risky'])
const AUTO_NOTE = 'Auto-assigned from their type in the CRM'

export async function autoAssignLists(opts: { personIds?: string[]; dryRun?: boolean } = {}): Promise<AutoAssignResult> {
  const lists = await prisma.mailingList.findMany({ where: { isActive: true }, select: { id: true, key: true } })
  const listId = new Map(lists.map((l) => [l.key, l.id]))
  const result: AutoAssignResult = { scanned: 0, added: {}, noEmail: 0, held: 0, unassigned: [] }
  let cursor: string | undefined

  for (;;) {
    const people = await prisma.crmPerson.findMany({
      where: { deletedAt: null, ...(opts.personIds ? { id: { in: opts.personIds } } : {}) },
      select: { id: true, fullName: true, email: true, roles: true, emailVerifiedStatus: true },
      orderBy: { id: 'asc' }, take: CHUNK, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    if (people.length === 0) break
    cursor = people[people.length - 1].id
    result.scanned += people.length

    const withEmail = people.map((p) => ({ p, email: normalizeListEmail(p.email ?? '') })).filter((x) => {
      if (!x.email) result.noEmail++
      return !!x.email
    }) as { p: (typeof people)[number]; email: string }[]
    const emails = withEmail.map((x) => x.email)
    const [suggested, existing, suppressed] = await Promise.all([
      suggestionsFor(withEmail.map((x) => x.p.id)),
      prisma.mailingListMember.findMany({ where: { email: { in: emails } }, select: { email: true, listId: true } }),
      prisma.mailingSuppression.findMany({ where: { email: { in: emails } }, select: { email: true } }),
    ])
    const have = new Set(existing.map((m) => `${m.listId}|${m.email}`))
    const blocked = new Set(suppressed.map((s) => s.email))

    const rows: { id: string; listId: string; email: string; personId: string; status: 'ACTIVE'; addedVia: 'IMPORT'; consentNote: string }[] = []
    for (const { p, email } of withEmail) {
      const keys = (suggested.get(p.id) ?? []).filter((k) => !MANUAL_ONLY.has(k) && listId.has(k))
      if (keys.length === 0) { result.unassigned.push({ id: p.id, name: p.fullName ?? '', email, roles: p.roles }); continue }
      if (blocked.has(email)) continue
      if (p.emailVerifiedStatus && HELD_BACK.has(p.emailVerifiedStatus)) { result.held++; continue }
      for (const k of keys) {
        const lid = listId.get(k)!
        if (have.has(`${lid}|${email}`)) continue
        rows.push({ id: `mlm_auto_${lid}_${p.id}`, listId: lid, email, personId: p.id, status: 'ACTIVE', addedVia: 'IMPORT', consentNote: AUTO_NOTE })
        result.added[k] = (result.added[k] ?? 0) + 1
      }
    }
    if (!opts.dryRun && rows.length) await prisma.mailingListMember.createMany({ data: rows, skipDuplicates: true })
    if (people.length < CHUNK) break
  }
  return result
}

export interface PruneResult {
  /** Auto-added memberships whose list no longer fits the person's type. */
  wrongType: number
  /** Memberships of a person who has since been deleted. */
  deletedPerson: number
  /** Memberships on an address the person no longer has. */
  staleAddress: number
  /** Addresses Hunter calls invalid or undeliverable, now suppressed everywhere. */
  invalid: number
}

/**
 * The daily clean-up before auto-assign. Only ever changes a status, never deletes a row:
 * - an address Hunter calls invalid/undeliverable is suppressed (BOUNCED) on every list, cold outreach included;
 * - a membership of a deleted person, or on an address no longer on their record, becomes REMOVED;
 * - an auto-added membership (never one added by hand, by sign-up or by reply) whose list no longer fits the person's type becomes REMOVED;
 *   that empties Investor updates of everyone auto-added there, since no type suggests it.
 * A REMOVED row also stops auto-assign adding the person back.
 */
export async function pruneLists(opts: { dryRun?: boolean } = {}): Promise<PruneResult> {
  const result: PruneResult = { wrongType: 0, deletedPerson: 0, staleAddress: 0, invalid: 0 }
  const lists = await prisma.mailingList.findMany({ select: { id: true, key: true } })
  const keyOf = new Map(lists.map((l) => [l.id, l.key]))
  const members = await prisma.mailingListMember.findMany({
    where: { status: 'ACTIVE', personId: { not: null } },
    select: { id: true, listId: true, email: true, personId: true, addedVia: true, consentNote: true, person: { select: { deletedAt: true, email: true, emails: true, emailVerifiedStatus: true } } },
  })
  const wrongTypeIds: string[] = [], deletedIds: string[] = [], staleIds: string[] = [], invalidEmails = new Set<string>()
  const personIds = [...new Set(members.map((m) => m.personId!))]
  const suggested = new Map<string, string[]>()
  for (let i = 0; i < personIds.length; i += 500) {
    for (const [id, keys] of await suggestionsFor(personIds.slice(i, i + 500))) suggested.set(id, keys)
  }
  for (const m of members) {
    const p = m.person!
    if (p.deletedAt) { deletedIds.push(m.id); continue }
    const mine = [p.email, ...p.emails].map((e) => normalizeListEmail(e ?? '')).filter(Boolean)
    if (mine.length && !mine.includes(m.email)) { staleIds.push(m.id); continue }
    if (m.email === normalizeListEmail(p.email ?? '') && (p.emailVerifiedStatus === 'invalid' || p.emailVerifiedStatus === 'undeliverable')) { invalidEmails.add(m.email); continue }
    const key = keyOf.get(m.listId)
    if (m.addedVia === 'IMPORT' && m.consentNote === AUTO_NOTE && key && key !== 'monthly_update' && !(suggested.get(m.personId!) ?? []).includes(key)) wrongTypeIds.push(m.id)
  }
  result.wrongType = wrongTypeIds.length
  result.deletedPerson = deletedIds.length
  result.staleAddress = staleIds.length
  result.invalid = invalidEmails.size
  if (opts.dryRun) return result
  const now = new Date()
  for (const ids of [wrongTypeIds, deletedIds, staleIds]) {
    for (let i = 0; i < ids.length; i += 1000) {
      await prisma.mailingListMember.updateMany({ where: { id: { in: ids.slice(i, i + 1000) }, status: 'ACTIVE' }, data: { status: 'REMOVED', statusAt: now } })
    }
  }
  for (const email of invalidEmails) await suppress(email, 'BOUNCED', 'Hunter: address is invalid')
  return result
}
