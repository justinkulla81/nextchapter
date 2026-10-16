import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { orgSlug } from '@/lib/crm/org-slug'
import {
  classifyDoors, isStrongBackground, REPLY_WINDOW_DAYS,
  type Door, type DoorPerson, type DoorRoute,
} from '@/lib/crm/warm-doors-rules'

// "Warm doors": a strong candidate has applied to an organization where we
// already have a warm way in, so Justin can backchannel and help them get the
// job. Built from what we already hold — applications on one side, the CRM's
// people and routes in on the other — with no new tables and no metered calls.
//
// Applications only: a candidate's watchlist is private search data the CRM
// must not read (src/test/company-wall.test.ts).
//
// A way in is a person who has written back to us in the last year, or a
// strong/medium route in that someone has asked about. Imported "warm" tags, LinkedIn connections and
// one-way outreach do not count.
//
// Whose contacts: only OUR CRM. A candidate's own contact list is private to
// them and is never read here; the existing backchannel feature already shows
// the candidate their own contacts.
//
// "Strong" is two facts, both required (rules in warm-doors-rules.ts):
//   background — calibrated seniority at Director or above, or a pedigree signal;
//   work done  — Candidate+ (an assessment, real outreach and applications,
//                search-effort minutes, or an alternate path). Never a grade: the unlock
//                schema's governing principle is to gate on work done.

const MAX_CANDIDATES_CHECKED = 150

export interface WarmDoorItem {
  candidate: { id: string; name: string }
  org: { id: string; name: string; slug: string | null }
  kind: 'applied'
  application: { title: string | null; appliedAt: Date }
  /** The interest began inside the "new" window. */
  isNew: boolean
  doors: Door[]
  strong: { background: string; workDone: string }
}

export async function loadWarmDoors(opts: { orgId?: string; newSinceHours?: number } = {}): Promise<WarmDoorItem[]> {
  const now = new Date()
  const newSince = new Date(now.getTime() - (opts.newSinceHours ?? 26) * 3_600_000)

  // 0. Who has actually written back to us in the last year. A reply is an
  // inbound email or LinkedIn message that has been reviewed — the unreviewed
  // rows are auto-logged mentions, not replies (they carry needsReview).
  const replyCutoff = new Date(now.getTime() - REPLY_WINDOW_DAYS * 86_400_000)
  const replies = await prisma.crmActivity.groupBy({
    by: ['personId'],
    where: {
      direction: 'INBOUND', type: { in: ['EMAIL', 'LINKEDIN_MESSAGE'] }, needsReview: false,
      occurredAt: { gte: replyCutoff }, personId: { not: null },
      person: { deletedAt: null },
    },
    _max: { occurredAt: true },
  })
  const lastReply = new Map<string, Date>()
  for (const r of replies) if (r.personId && r._max.occurredAt) lastReply.set(r.personId, r._max.occurredAt)

  // 1. Organizations where we have a real way in, optionally just one.
  const orgs = await prisma.crmOrganization.findMany({
    where: {
      ...(opts.orgId ? { id: opts.orgId } : {}),
      NOT: { canonicalNameNormalized: { startsWith: '-' } },
      OR: [
        { affiliations: { some: { isCurrent: true, personId: { in: [...lastReply.keys()] } } } },
        { introPathsAsTarget: { some: { status: { in: ['ASKED', 'INTRO_MADE'] }, strength: { in: ['STRONG', 'MEDIUM'] } } } },
      ],
    },
    select: {
      id: true, name: true, canonicalNameNormalized: true,
      affiliations: {
        where: { isCurrent: true, personId: { in: [...lastReply.keys()] } },
        select: { title: true, person: { select: { id: true, fullName: true } } },
      },
      introPathsAsTarget: {
        where: { status: { in: ['ASKED', 'INTRO_MADE'] }, strength: { in: ['STRONG', 'MEDIUM'] } },
        select: { id: true, strength: true, status: true, connectorName: true, connectorPerson: { select: { id: true, fullName: true } } },
      },
    },
  })
  if (orgs.length === 0) return []

  const doorsByOrg = new Map(orgs.map((o) => {
    const people: DoorPerson[] = o.affiliations.map((a) => ({
      id: a.person.id, fullName: a.person.fullName, title: a.title, lastReplyAt: lastReply.get(a.person.id) ?? null,
    }))
    const routes: DoorRoute[] = o.introPathsAsTarget.map((p) => ({
      id: p.id, strength: p.strength, status: p.status,
      connectorName: p.connectorPerson?.fullName ?? p.connectorName,
      connectorPersonId: p.connectorPerson?.id ?? null,
    }))
    return [o.id, classifyDoors(people, routes, now)] as const
  }))
  const withDoor = orgs.filter((o) => (doorsByOrg.get(o.id) ?? []).length > 0)
  if (withDoor.length === 0) return []
  const orgByKey = new Map(withDoor.map((o) => [o.canonicalNameNormalized, o]))

  // 2. Candidates with a live application at one of them. Application company
  // names are free text, so match on the org's display name and re-check on the
  // normalized form.
  const applied = await prisma.jobPosting.findMany({
    where: {
      appliedAt: { not: null }, declinedAt: null, offerReceivedAt: null,
      OR: withDoor.map((o) => ({ companyName: { equals: o.name, mode: 'insensitive' as const } })),
    },
    select: { candidateId: true, companyName: true, title: true, appliedAt: true },
  })

  type Interest = { candidateId: string; orgKey: string; at: Date; title: string | null }
  const interests: Interest[] = []
  for (const a of applied) {
    const key = normalizeOrgName(a.companyName ?? '')
    if (orgByKey.has(key) && a.appliedAt) interests.push({ candidateId: a.candidateId, orgKey: key, at: a.appliedAt, title: a.title })
  }
  if (interests.length === 0) return []

  // 3. Background first (one query), then the work-done check only for those who pass.
  const ids = [...new Set(interests.map((i) => i.candidateId))].slice(0, MAX_CANDIDATES_CHECKED)
  const profiles = await prisma.candidateProfile.findMany({
    where: { id: { in: ids }, isSampleData: false },
    select: { id: true, firstName: true, lastName: true, levelRankScore: true, pedigreeBonus: true },
  })
  const withBackground = profiles
    .map((p) => ({ p, background: isStrongBackground(p) }))
    .filter((x): x is { p: (typeof profiles)[number]; background: string } => x.background !== null)
  const unlocked = await Promise.all(withBackground.map(async ({ p, background }) => {
    const status = await isDossierUnlocked(p.id).catch(() => null)
    return status?.unlocked ? { p, background, workDone: status.reason } : null
  }))
  const strong = new Map(unlocked.filter((x): x is NonNullable<typeof x> => x !== null).map((x) => [x.p.id, x]))

  // 4. One item per candidate and organization (their most recent application).
  const items = new Map<string, WarmDoorItem>()
  for (const i of interests) {
    const s = strong.get(i.candidateId)
    const org = orgByKey.get(i.orgKey)
    if (!s || !org) continue
    const key = `${i.candidateId}:${org.id}`
    const prev = items.get(key)
    const item: WarmDoorItem = prev ?? {
      candidate: { id: s.p.id, name: [s.p.firstName, s.p.lastName].filter(Boolean).join(' ') || 'Unnamed' },
      org: { id: org.id, name: org.name, slug: orgSlug(org.canonicalNameNormalized) },
      kind: 'applied',
      application: { title: i.title, appliedAt: i.at },
      isNew: false,
      doors: doorsByOrg.get(org.id) ?? [],
      strong: { background: s.background, workDone: s.workDone },
    }
    if (i.at > item.application.appliedAt) item.application = { title: i.title, appliedAt: i.at }
    item.isNew = item.isNew || i.at >= newSince
    items.set(key, item)
  }

  return [...items.values()].sort((a, b) => Number(b.isNew) - Number(a.isNew) || a.candidate.name.localeCompare(b.candidate.name))
}
