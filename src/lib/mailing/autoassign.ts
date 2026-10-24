import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeListEmail } from './rules'
import { suggestionsFor } from './lists'

/**
 * Subscribes CRM people to the mailing lists that fit their type.
 *
 * Only ever creates a missing membership. It never touches a person who is
 * already on, was unsubscribed from, complained about or bounced off a list,
 * and never adds anyone with a suppression (including Do not email).
 * The Monthly Update is not auto-filled: it stays opt-in / sent-to.
 */
export interface AutoAssignResult {
  scanned: number
  added: Record<string, number>
  noEmail: number
  /** Have an email but their type fits no list. */
  unassigned: { id: string; name: string; email: string; roles: string[] }[]
}

const CHUNK = 400

export async function autoAssignLists(opts: { personIds?: string[]; dryRun?: boolean } = {}): Promise<AutoAssignResult> {
  const lists = await prisma.mailingList.findMany({ where: { isActive: true }, select: { id: true, key: true } })
  const listId = new Map(lists.map((l) => [l.key, l.id]))
  const result: AutoAssignResult = { scanned: 0, added: {}, noEmail: 0, unassigned: [] }
  let cursor: string | undefined

  for (;;) {
    const people = await prisma.crmPerson.findMany({
      where: { deletedAt: null, ...(opts.personIds ? { id: { in: opts.personIds } } : {}) },
      select: { id: true, fullName: true, email: true, roles: true },
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
      const keys = (suggested.get(p.id) ?? []).filter((k) => k !== 'monthly_update' && listId.has(k))
      if (keys.length === 0) { result.unassigned.push({ id: p.id, name: p.fullName ?? '', email, roles: p.roles }); continue }
      if (blocked.has(email)) continue
      for (const k of keys) {
        const lid = listId.get(k)!
        if (have.has(`${lid}|${email}`)) continue
        rows.push({ id: `mlm_auto_${lid}_${p.id}`, listId: lid, email, personId: p.id, status: 'ACTIVE', addedVia: 'IMPORT', consentNote: 'Auto-assigned from their type in the CRM' })
        result.added[k] = (result.added[k] ?? 0) + 1
      }
    }
    if (!opts.dryRun && rows.length) await prisma.mailingListMember.createMany({ data: rows, skipDuplicates: true })
    if (people.length < CHUNK) break
  }
  return result
}
