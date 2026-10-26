import 'server-only'
import { prisma } from '@/lib/prisma'
import { matchFirmToOrgs, domainOf, type OrgForMatch } from '@/lib/search-firms/match'
import { normalizeOrgName } from '@/lib/text/org-name-match'

// Brings every college (CollegeProfile + LocalCollege, one per IPEDS id) into the CRM as an organization, the way
// search firms are (src/lib/search-firms/sync.ts): the same name is that college; a similar name or the same website
// under a different name goes on the Review List for a person to decide, never guessed; otherwise a new one is added.

export interface CollegeToLink { unitid: string; name: string; website: string | null; city: string | null; state: string }

export type CollegeLinkPlan =
  | { unitid: string; kind: 'matched'; orgId: string }
  | { unitid: string; kind: 'review'; orgId: string; reason: string }
  | { unitid: string; kind: 'add' }

/** Pure: what to do with one college. A domain-only match is a guess (a system office shares its campuses' site), so it goes to review. */
export function planCollegeLink(c: CollegeToLink, orgs: OrgForMatch[]): CollegeLinkPlan {
  const m = matchFirmToOrgs({ name: c.name, website: c.website, domain: domainOf(c.website) }, orgs)
  if (m.kind === 'matched') {
    if (m.basis === 'name') return { unitid: c.unitid, kind: 'matched', orgId: m.orgId }
    const o = orgs.find((x) => x.id === m.orgId)!
    return { unitid: c.unitid, kind: 'review', orgId: m.orgId, reason: `Same website, different name: "${o.name}"` }
  }
  if (m.kind === 'review') return { unitid: c.unitid, kind: 'review', orgId: m.orgId, reason: m.reason }
  return { unitid: c.unitid, kind: 'add' }
}

export async function loadCollegesToLink(): Promise<CollegeToLink[]> {
  const [profiles, locals] = await Promise.all([
    prisma.collegeProfile.findMany({ select: { unitid: true, name: true, website: true, city: true, state: true } }),
    prisma.localCollege.findMany({ select: { id: true, name: true, website: true, city: true, state: true } }),
  ])
  const byId = new Map<string, CollegeToLink>()
  for (const l of locals) byId.set(l.id, { unitid: l.id, name: l.name, website: l.website, city: l.city, state: l.state })
  for (const p of profiles) byId.set(p.unitid, { unitid: p.unitid, name: p.name, website: p.website, city: p.city, state: p.state })
  return [...byId.values()]
}

/** Existing links, tolerating the table not existing yet (dry runs before the SQL is applied). */
export async function existingLinks(): Promise<Map<string, { crmOrgId: string | null; matchStatus: string }>> {
  try {
    const rows = await prisma.collegeOrgLink.findMany({ select: { unitid: true, crmOrgId: true, matchStatus: true } })
    return new Map(rows.map((r) => [r.unitid, r]))
  } catch {
    return new Map()
  }
}

export async function tagUniversity(orgId: string): Promise<void> {
  const org = await prisma.crmOrganization.findUniqueOrThrow({ where: { id: orgId }, select: { orgTypes: true } })
  if (!org.orgTypes.includes('UNIVERSITY')) await prisma.crmOrganization.update({ where: { id: orgId }, data: { orgTypes: { push: 'UNIVERSITY' } } })
}

export async function createCollegeOrg(c: CollegeToLink): Promise<string> {
  const canonical = normalizeOrgName(c.name)
  const same = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: canonical }, select: { id: true } })
  if (same) { await tagUniversity(same.id); return same.id }
  const org = await prisma.crmOrganization.create({
    data: { name: c.name, canonicalNameNormalized: canonical, orgTypes: ['UNIVERSITY'], website: c.website, hqCity: c.city, hqRegion: c.state, usState: c.state },
    select: { id: true },
  })
  return org.id
}

/** Records a college's organization, and keeps LocalCollege.crmOrgId (the admin college profile reads it) in step. */
export async function recordLink(unitid: string, orgId: string, status: 'MATCHED' | 'ADDED'): Promise<void> {
  await prisma.collegeOrgLink.upsert({
    where: { unitid },
    create: { unitid, crmOrgId: orgId, matchStatus: status },
    update: { crmOrgId: orgId, matchStatus: status, reviewOrgId: null, reviewReason: null },
  })
  await prisma.localCollege.updateMany({ where: { id: unitid, crmOrgId: null }, data: { crmOrgId: orgId } })
}

export async function recordReview(unitid: string, orgId: string, reason: string): Promise<void> {
  await prisma.collegeOrgLink.upsert({
    where: { unitid },
    create: { unitid, matchStatus: 'REVIEW', reviewOrgId: orgId, reviewReason: reason },
    update: { matchStatus: 'REVIEW', reviewOrgId: orgId, reviewReason: reason },
  })
}

/** Review List: the college and the suggested organization are the same. */
export async function resolveCollegeAsSame(unitid: string): Promise<void> {
  const row = await prisma.collegeOrgLink.findUnique({ where: { unitid } })
  if (!row?.reviewOrgId) return
  await tagUniversity(row.reviewOrgId)
  await recordLink(unitid, row.reviewOrgId, 'MATCHED')
}

/** Review List: different organizations — add the college as its own. */
export async function resolveCollegeAsDifferent(unitid: string): Promise<void> {
  const colleges = await loadCollegesToLink()
  const c = colleges.find((x) => x.unitid === unitid)
  if (!c) return
  await recordLink(unitid, await createCollegeOrg(c), 'ADDED')
}
