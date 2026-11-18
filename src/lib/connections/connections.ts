import 'server-only'
// Connected portals, the part that reads and writes (rules in ./rules.ts). Every read is by an indexed key and bounded: a portal has a
// handful of connections, and each shared list is at most 15 narrow rows. Nothing here reads a person.

import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { orgAppUrl, mainOrigin } from '@/lib/org-hosts'
import { orgHostKindOf } from '@/lib/higher-ed/workspaces'
import { sendConnectionRequestEmail } from '@/lib/email/send-connection-request'
import {
  decideBlocked, defaultSharesFor, demoMismatch, endBlocked, mySharesIn, normalizeShares, otherParty, partyKey, requestBlocked, shareBlocked,
  sharedWithMe, sideOf, type Decision, type Party, type PartyKind, type ShareKey,
} from './rules'

export type PartyInfo = Party & { name: string; label: string; demo: boolean; href: string | null }

const ORG_LABEL: Record<string, string> = {
  COLLEGE: 'College', WORKFORCE_BOARD: 'Workforce board', ECONOMIC_DEVELOPMENT: 'Economic development', CHAMBER: 'Chamber', COMMUNITY_ORG: 'Community organization',
}
const LIST = 15

/** Names and kinds for a set of parties, in two indexed reads. */
async function describe(parties: Party[]): Promise<Map<string, PartyInfo>> {
  const ids = (k: PartyKind) => [...new Set(parties.filter((p) => p.kind === k).map((p) => p.id))]
  const [insts, emps] = await Promise.all([
    ids('INSTITUTION').length ? prisma.institution.findMany({ where: { id: { in: ids('INSTITUTION') } }, select: { id: true, name: true, programBrandName: true, orgType: true, isDemo: true } }) : [],
    ids('EMPLOYER').length ? prisma.employerProfile.findMany({ where: { id: { in: ids('EMPLOYER') } }, select: { id: true, companyName: true, isSampleData: true } }) : [],
  ])
  const out = new Map<string, PartyInfo>()
  for (const i of insts) out.set(partyKey({ kind: 'INSTITUTION', id: i.id }), { kind: 'INSTITUTION', id: i.id, name: i.programBrandName ?? i.name, label: ORG_LABEL[i.orgType ?? 'COLLEGE'] ?? 'Organization', demo: i.isDemo, href: null })
  for (const e of emps) out.set(partyKey({ kind: 'EMPLOYER', id: e.id }), { kind: 'EMPLOYER', id: e.id, name: e.companyName, label: 'Employer', demo: e.isSampleData, href: null })
  return out
}

const pairWhere = (a: Party, b: Party) => ({
  OR: [
    { requesterKind: a.kind, requesterId: a.id, targetKind: b.kind, targetId: b.id },
    { requesterKind: b.kind, requesterId: b.id, targetKind: a.kind, targetId: a.id },
  ],
})
const mineWhere = (me: Party) => ({ OR: [{ requesterKind: me.kind, requesterId: me.id }, { targetKind: me.kind, targetId: me.id }] })

async function log(connectionId: string, side: 'requester' | 'target', actor: string, action: string, shares: string[] = []) {
  await prisma.portalConnectionEvent.create({ data: { connectionId, side, actor, action, shares } })
}

/** Where the other side answers a request: its admin's Connected organizations, or the employer's network page. */
async function answerUrl(p: Party): Promise<string> {
  if (p.kind === 'EMPLOYER') return `${mainOrigin()}/talent/network`
  const i = await prisma.institution.findUnique({ where: { id: p.id }, select: { slug: true, orgType: true } })
  return i ? orgAppUrl(i.slug, orgHostKindOf(i.orgType), '/admin/connections') : mainOrigin()
}

/** Who to tell about a request: the other portal's administrators, or the employer account's own email. At most five. */
async function adminEmails(p: Party): Promise<string[]> {
  if (p.kind === 'INSTITUTION') {
    const rows = await prisma.institutionUser.findMany({ where: { institutionId: p.id, role: 'INSTITUTION_ADMIN', revokedAt: null }, select: { invitedEmail: true }, take: 5 })
    return [...new Set(rows.map((r) => r.invitedEmail.toLowerCase()))]
  }
  const e = await prisma.employerProfile.findUnique({ where: { id: p.id }, select: { userId: true } })
  if (!e) return []
  const { data } = await createAdminClient().auth.admin.getUserById(e.userId).catch(() => ({ data: null }))
  const email = data?.user?.email
  return email ? [email.toLowerCase()] : []
}

export type ActionResult = { ok: true; connectionId: string; emailed?: number } | { ok: false; error: string }

/** Ask another organization to connect. Re-asking after a decline or an end reuses the pair's row. */
export async function requestConnection(args: { me: Party; other: Party; actor: string }): Promise<ActionResult> {
  const { me, other } = args
  const info = await describe([me, other])
  const mine = info.get(partyKey(me))
  const theirs = info.get(partyKey(other))
  if (!mine || !theirs) return { ok: false, error: 'That organization is not on NextChapter.' }
  if (demoMismatch(mine, theirs)) return { ok: false, error: 'A demo portal can only connect with other demos.' }
  const existing = await prisma.portalConnection.findFirst({ where: pairWhere(me, other) })
  const blocked = requestBlocked({ me, other, existing })
  if (blocked) return { ok: false, error: blocked }
  const now = new Date()
  const data = {
    requesterKind: me.kind, requesterId: me.id, targetKind: other.kind, targetId: other.id, status: 'REQUESTED',
    requesterShares: defaultSharesFor(me.kind), targetShares: [] as string[], requestedBy: args.actor, requestedAt: now,
    respondedBy: null, respondedAt: null, endedBy: null, endedAt: null,
  }
  const row = existing ? await prisma.portalConnection.update({ where: { id: existing.id }, data }) : await prisma.portalConnection.create({ data })
  await log(row.id, 'requester', args.actor, 'REQUESTED', data.requesterShares)
  // Demos never email anyone.
  let emailed = 0
  if (!mine.demo) {
    const [to, url] = await Promise.all([adminEmails(other), answerUrl(other)])
    for (const email of to) if ((await sendConnectionRequestEmail({ to: email, fromName: mine.name, fromLabel: mine.label, toName: theirs.name, url })).sent) emailed++
  }
  return { ok: true, connectionId: row.id, emailed }
}

async function loadMine(id: string, me: Party) {
  const row = await prisma.portalConnection.findUnique({ where: { id } })
  return row && sideOf(row, me) ? row : null
}

export async function decideConnection(args: { me: Party; id: string; decision: Decision; actor: string }): Promise<ActionResult> {
  const row = await loadMine(args.id, args.me)
  if (!row) return { ok: false, error: 'That request was not found.' }
  const blocked = decideBlocked(row, args.me)
  if (blocked) return { ok: false, error: blocked }
  const accept = args.decision === 'accept'
  const targetShares = accept ? defaultSharesFor(args.me.kind) : []
  await prisma.portalConnection.update({ where: { id: row.id }, data: { status: accept ? 'ACTIVE' : 'DECLINED', respondedBy: args.actor, respondedAt: new Date(), targetShares } })
  await log(row.id, 'target', args.actor, accept ? 'ACCEPTED' : 'DECLINED', targetShares)
  return { ok: true, connectionId: row.id }
}

export async function setShares(args: { me: Party; id: string; shares: string[]; actor: string }): Promise<ActionResult> {
  const row = await loadMine(args.id, args.me)
  if (!row) return { ok: false, error: 'That connection was not found.' }
  const blocked = shareBlocked(row, args.me)
  if (blocked) return { ok: false, error: blocked }
  const side = sideOf(row, args.me)!
  const shares = normalizeShares(args.shares, args.me.kind)
  await prisma.portalConnection.update({ where: { id: row.id }, data: side === 'requester' ? { requesterShares: shares } : { targetShares: shares } })
  await log(row.id, side, args.actor, 'SHARES_CHANGED', shares)
  return { ok: true, connectionId: row.id }
}

export async function endConnection(args: { me: Party; id: string; actor: string }): Promise<ActionResult> {
  const row = await loadMine(args.id, args.me)
  if (!row) return { ok: false, error: 'That connection was not found.' }
  const blocked = endBlocked(row, args.me)
  if (blocked) return { ok: false, error: blocked }
  const side = sideOf(row, args.me)!
  await prisma.portalConnection.update({ where: { id: row.id }, data: { status: 'ENDED', endedBy: args.actor, endedAt: new Date(), requesterShares: [], targetShares: [] } })
  await log(row.id, side, args.actor, 'ENDED')
  return { ok: true, connectionId: row.id }
}

// ---- What the other side shares --------------------------------------------------------------------------------------------------

export type SharedJob = { id: string; title: string; company: string; location: string | null; url: string | null }
export type SharedEvent = { id: string; title: string; startsAt: Date; location: string | null; url: string | null }
export type SharedLayoff = { id: string; employer: string; title: string; seats: number | null; since: Date }
export type SharedItems = { JOBS?: SharedJob[]; EVENTS?: SharedEvent[]; LAYOFFS?: SharedLayoff[] }

const JOB_SELECT = { id: true, title: true, companyName: true, location: true, url: true } as const
const asJob = (j: { id: string; title: string; companyName: string | null; location: string | null; url: string | null }): SharedJob => ({ id: j.id, title: j.title, company: j.companyName ?? '', location: j.location, url: j.url })

async function jobsOf(p: Party): Promise<SharedJob[]> {
  if (p.kind === 'EMPLOYER') {
    const posted = await prisma.exclusiveJobPosting.findMany({ where: { submittedByEmployerId: p.id, status: 'approved', archivedAt: null }, orderBy: { createdAt: 'desc' }, take: LIST, select: JOB_SELECT })
    if (posted.length >= LIST) return posted.map(asJob)
    const emp = await prisma.employerProfile.findUnique({ where: { id: p.id }, select: { companyId: true } })
    const open = emp?.companyId
      ? await prisma.companyJobOpening.findMany({ where: { companyId: emp.companyId, closedAt: null }, orderBy: { lastSeenAt: 'desc' }, take: LIST - posted.length, select: JOB_SELECT })
      : []
    return [...posted, ...open].map(asJob)
  }
  // An organization's jobs: the ones it featured first, then the ones added for its group, approved and live.
  const featured = await prisma.featuredJob.findMany({ where: { institutionId: p.id }, orderBy: { createdAt: 'desc' }, take: LIST, select: { postingId: true } })
  const [picked, added] = await Promise.all([
    featured.length ? prisma.exclusiveJobPosting.findMany({ where: { id: { in: featured.map((f) => f.postingId) }, status: 'approved', archivedAt: null }, select: JOB_SELECT }) : [],
    prisma.exclusiveJobPosting.findMany({ where: { institutionScopeId: p.id, status: 'approved', archivedAt: null }, orderBy: { createdAt: 'desc' }, take: LIST, select: JOB_SELECT }),
  ])
  const seen = new Set<string>()
  return [...picked, ...added].filter((j) => (seen.has(j.id) ? false : (seen.add(j.id), true))).slice(0, LIST).map(asJob)
}

async function eventsOf(p: Party): Promise<SharedEvent[]> {
  if (p.kind !== 'INSTITUTION') return []
  const rows = await prisma.collegeEvent.findMany({
    where: { institutionId: p.id, cancelledAt: null, startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' }, take: LIST,
    select: { id: true, title: true, startsAt: true, location: true, url: true },
  })
  return rows
}

async function layoffsOf(p: Party): Promise<SharedLayoff[]> {
  if (p.kind !== 'INSTITUTION') return []
  const rows = await prisma.rapidResponse.findMany({
    where: { institutionId: p.id, isActive: true }, orderBy: { createdAt: 'desc' }, take: LIST,
    select: { id: true, employerName: true, title: true, seats: true, createdAt: true },
  })
  return rows.map((r) => ({ id: r.id, employer: r.employerName, title: r.title, seats: r.seats, since: r.createdAt }))
}

async function itemsOf(p: Party, keys: ShareKey[]): Promise<SharedItems> {
  const out: SharedItems = {}
  await Promise.all(keys.map(async (k) => {
    if (k === 'JOBS') out.JOBS = await jobsOf(p)
    if (k === 'EVENTS') out.EVENTS = await eventsOf(p)
    if (k === 'LAYOFFS') out.LAYOFFS = await layoffsOf(p)
  }))
  return out
}

// ---- The screen's data ------------------------------------------------------------------------------------------------------------

export type ConnectionView = {
  id: string; other: PartyInfo; status: string; asked: 'me' | 'them'; since: Date
  myShares: ShareKey[]; theirShares: ShareKey[]; shared: SharedItems
}
export type Candidate = PartyInfo & { why: string }
export type ConnectionsData = { me: PartyInfo; incoming: ConnectionView[]; outgoing: ConnectionView[]; active: ConnectionView[]; candidates: Candidate[] }

/** Organizations this one already knows that have a portal of their own: the ones it linked, the ones that linked it, and employers. */
async function knownPortals(me: Party): Promise<{ party: Party; why: string }[]> {
  if (me.kind === 'EMPLOYER') {
    const rows = await prisma.employerRelatedOrg.findMany({ where: { employerProfileId: me.id, linkedInstitutionId: { not: null } }, select: { linkedInstitutionId: true }, take: 50 })
    return rows.map((r) => ({ party: { kind: 'INSTITUTION' as const, id: r.linkedInstitutionId! }, why: 'You linked them' }))
  }
  const [linked, linkedYou, employers] = await Promise.all([
    prisma.ecosystemPartner.findMany({ where: { institutionId: me.id, linkedInstitutionId: { not: null } }, select: { linkedInstitutionId: true }, take: 50 }),
    prisma.ecosystemPartner.findMany({ where: { linkedInstitutionId: me.id }, select: { institutionId: true }, take: 50 }),
    prisma.employerRelatedOrg.findMany({ where: { linkedInstitutionId: me.id }, select: { employerProfileId: true }, take: 50 }),
  ])
  return [
    ...linked.map((r) => ({ party: { kind: 'INSTITUTION' as const, id: r.linkedInstitutionId! }, why: 'You linked them' })),
    ...linkedYou.map((r) => ({ party: { kind: 'INSTITUTION' as const, id: r.institutionId }, why: 'They linked you' })),
    ...employers.map((r) => ({ party: { kind: 'EMPLOYER' as const, id: r.employerProfileId }, why: 'They linked you' })),
  ]
}

/** Portals on NextChapter by name (a few hundred rows at most today; bounded to ten of each kind). */
async function searchPortals(q: string, demo: boolean): Promise<{ party: Party; why: string }[]> {
  const term = q.trim().slice(0, 80)
  if (term.length < 2) return []
  const [insts, emps] = await Promise.all([
    prisma.institution.findMany({ where: { isDemo: demo, OR: [{ name: { contains: term, mode: 'insensitive' } }, { programBrandName: { contains: term, mode: 'insensitive' } }] }, select: { id: true }, take: 10 }),
    prisma.employerProfile.findMany({ where: { isSampleData: demo, companyName: { contains: term, mode: 'insensitive' } }, select: { id: true }, take: 10 }),
  ])
  return [
    ...insts.map((i) => ({ party: { kind: 'INSTITUTION' as const, id: i.id }, why: 'On NextChapter' })),
    ...emps.map((e) => ({ party: { kind: 'EMPLOYER' as const, id: e.id }, why: 'On NextChapter' })),
  ]
}

export async function connectionsFor(me: Party, q = ''): Promise<ConnectionsData | null> {
  const rows = await prisma.portalConnection.findMany({ where: { ...mineWhere(me), status: { in: ['REQUESTED', 'ACTIVE'] } }, orderBy: { updatedAt: 'desc' }, take: 100 })
  const meInfoMap = await describe([me])
  const meInfo = meInfoMap.get(partyKey(me))
  if (!meInfo) return null
  const [known, found] = await Promise.all([knownPortals(me), searchPortals(q, meInfo.demo)])
  const taken = new Set(rows.map((r) => partyKey(otherParty(r, me)!)))
  taken.add(partyKey(me))
  const pool = [...known, ...found].filter((c) => !taken.has(partyKey(c.party)))
  const info = await describe([...rows.map((r) => otherParty(r, me)!), ...pool.map((c) => c.party)])

  const views = await Promise.all(rows.map(async (r): Promise<ConnectionView | null> => {
    const other = info.get(partyKey(otherParty(r, me)!))
    if (!other) return null
    const theirShares = sharedWithMe(r, me)
    return {
      id: r.id, other, status: r.status, asked: sideOf(r, me) === 'requester' ? 'me' : 'them', since: r.respondedAt ?? r.requestedAt,
      myShares: mySharesIn(r, me), theirShares, shared: r.status === 'ACTIVE' ? await itemsOf(other, theirShares) : {},
    }
  }))
  const v = views.filter((x): x is ConnectionView => !!x)
  const seen = new Set<string>()
  const candidates: Candidate[] = []
  for (const c of pool) {
    const k = partyKey(c.party)
    const p = info.get(k)
    if (seen.has(k) || !p || demoMismatch(p, meInfo)) continue
    seen.add(k)
    candidates.push({ ...p, why: c.why })
  }
  return {
    me: meInfo,
    incoming: v.filter((x) => x.status === 'REQUESTED' && x.asked === 'them'),
    outgoing: v.filter((x) => x.status === 'REQUESTED' && x.asked === 'me'),
    active: v.filter((x) => x.status === 'ACTIVE'),
    candidates: candidates.slice(0, 20),
  }
}

/** How many requests are waiting for this organization's answer (for a nudge on the admin overview). */
export async function waitingCount(me: Party): Promise<number> {
  return prisma.portalConnection.count({ where: { targetKind: me.kind, targetId: me.id, status: 'REQUESTED' } }).catch(() => 0)
}
