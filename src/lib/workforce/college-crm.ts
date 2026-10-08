import 'server-only'
import { prisma } from '@/lib/prisma'
import { findEmailOwner } from '@/lib/crm/email-owner'
import { strictOrgKey } from '@/lib/crm/normalize'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { COLLEGE_ROLES, type CollegeRole } from './college-pages'
import { isPersonalEmail } from './college-score'
import { titleLeadsRole } from './college-contacts'

/** "Dr. Chad Warren", "Kelsey Bolton '09", "Cody D. Miller, MPA" → the name alone. */
export function cleanPersonName(raw: string): string {
  return raw
    .replace(/^\s*(dr|mr|mrs|ms|mx|prof|rev)\.?\s+/i, '')
    .replace(/,?\s+[A-Z]?'\d{2}\b/g, '')
    .replace(/,\s*([A-Z][A-Za-z.]{1,6}\.?)(\s*,\s*[A-Z][A-Za-z.]{1,6}\.?)*\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A college leader is a partnership prospect — business development — not
 * the user acquisition the alumni office role maps to by default.
 */
const COLLEGE_GOALS = ['BD'] as const

type OrgRef = { id: string; name: string; orgTypes: string[] }

export async function orgsByKey(): Promise<Map<string, OrgRef>> {
  const orgs = await prisma.crmOrganization.findMany({ select: { id: true, name: true, orgTypes: true } })
  return new Map(orgs.map((o) => [strictOrgKey(o.name, normalizeOrgName), o]))
}

/**
 * The college's organization in the CRM: the one it is linked to, else one
 * with the same name (marked a university if it was not), else a new one.
 * The link is kept on the college.
 */
export async function ensureCollegeOrg(
  college: { id: string; name: string; website: string | null; city: string | null; state: string },
  byKey?: Map<string, OrgRef>,
): Promise<OrgRef> {
  const linked = await prisma.localCollege.findUnique({ where: { id: college.id }, select: { crmOrgId: true } })
  let org: OrgRef | null | undefined = linked?.crmOrgId
    ? await prisma.crmOrganization.findUnique({ where: { id: linked.crmOrgId }, select: { id: true, name: true, orgTypes: true } })
    : null
  const key = strictOrgKey(college.name, normalizeOrgName)
  if (!org) org = (byKey ?? await orgsByKey()).get(key)
  if (!org) {
    const canonical = normalizeOrgName(college.name)
    org = await prisma.crmOrganization.upsert({
      where: { canonicalNameNormalized: canonical },
      update: {},
      create: {
        name: college.name, canonicalNameNormalized: canonical, orgTypes: ['UNIVERSITY'],
        website: college.website, hqCity: college.city, hqRegion: college.state, usState: college.state,
      },
      select: { id: true, name: true, orgTypes: true },
    })
    byKey?.set(key, org)
  }
  if (!org.orgTypes.includes('UNIVERSITY')) {
    await prisma.crmOrganization.update({ where: { id: org.id }, data: { orgTypes: { push: 'UNIVERSITY' } } })
    org.orgTypes.push('UNIVERSITY')
  }
  if (linked?.crmOrgId !== org.id) await prisma.localCollege.update({ where: { id: college.id }, data: { crmOrgId: org.id } })
  return org
}

/**
 * Which college contacts belong in the CRM: a named leader with a leader's
 * title and their own email (not careers@, giving@ or advancementvp@), at a
 * college ranked A or B. Everything else stays on the Colleges page only.
 */
export function crmWorthy(c: { role: string; name: string | null; title: string | null; email: string | null }, tier: string | null): boolean {
  return !!c.name && titleLeadsRole(c.title, c.role) && isPersonalEmail(c.email, c.name) && (tier === 'A' || tier === 'B')
}

/**
 * Adds the CRM-worthy college contacts as people at P2 with the alumni
 * office role, each affiliated with the college as an organization.
 *
 * Same rules as the CHRO sync: an email already in the CRM is that person
 * (their record gains the role and the affiliation; a priority already set
 * is kept); a removed person is never brought back; and a new person whose
 * name matches someone already in the CRM is added flagged for the Review
 * List, so a merge is decided by a person, not guessed.
 */
export async function addCollegeContactsToCrm(): Promise<{ added: number; matched: number; review: number; skippedRemoved: number }> {
  const contacts = await prisma.collegeContact.findMany({ where: { crmPersonId: null, name: { not: null }, email: { not: null } } })
  const colleges = new Map((await prisma.localCollege.findMany({
    where: { id: { in: [...new Set(contacts.map((c) => c.collegeId))] } },
    select: { id: true, name: true, tier: true, rank: true, website: true, city: true, state: true },
  })).map((c) => [c.id, c]))
  const worthy = contacts.filter((c) => crmWorthy(c, colleges.get(c.collegeId)?.tier ?? null))

  const orgByKey = await orgsByKey()
  const roles = ['ALUMNI_OFFICE'] as const
  let added = 0
  let matched = 0
  let review = 0
  let skippedRemoved = 0

  for (const c of worthy) {
    const college = colleges.get(c.collegeId)!
    const name = cleanPersonName(c.name!)
    const title = c.title ?? COLLEGE_ROLES[c.role as CollegeRole]?.label ?? null

    const org = await ensureCollegeOrg(college, orgByKey)
    const note = `${title ?? 'Leader'} at ${college.name} (college rank ${college.rank}, tier ${college.tier}). From the college's own website: ${c.sourceUrl}`
    const owner = await findEmailOwner(c.email, { includeDeleted: true })
    let personId: string
    if (owner?.deleted) {
      // Taken out of the CRM on purpose — do not bring them back.
      skippedRemoved++
      continue
    } else if (owner) {
      const p = await prisma.crmPerson.findUniqueOrThrow({ where: { id: owner.id }, select: { roles: true, goals: true, priority: true } })
      const nextRoles = [...new Set([...p.roles, ...roles])]
      await prisma.crmPerson.update({
        where: { id: owner.id },
        data: {
          roles: nextRoles,
          goals: [...new Set([...p.goals, ...COLLEGE_GOALS])],
          ...(p.priority ? {} : { priority: 'P2' }),
        },
      })
      personId = owner.id
      matched++
    } else {
      const sameName = await prisma.crmPerson.findFirst({
        where: { fullName: { equals: name, mode: 'insensitive' }, deletedAt: null },
        select: { id: true },
      })
      const [firstName, ...rest] = name.split(' ')
      const person = await prisma.crmPerson.create({
        data: {
          fullName: name,
          firstName,
          lastName: rest.length ? rest[rest.length - 1] : null,
          email: c.email,
          emails: [c.email!],
          phone: c.phone,
          roles: [...roles],
          goals: [...COLLEGE_GOALS],
          priority: 'P2',
          normalizedKey: `${name.toLowerCase()}|${normalizeOrgName(college.name)}`,
          notes: sameName ? `${note}\n\nSomeone named ${name} is already in the CRM (${sameName.id}) — same person? Merge or clear on the Review List.` : note,
          // An unsure match goes to the Review List rather than being merged by guess.
          needsCompletion: !!sameName,
        },
      })
      personId = person.id
      if (sameName) review++
      else added++
    }

    await prisma.crmAffiliation.upsert({
      where: { personId_orgId_title: { personId, orgId: org.id, title: title ?? '' } },
      update: { isCurrent: true },
      create: { personId, orgId: org.id, title, isPrimary: true, isCurrent: true },
    })
    await prisma.collegeContact.update({ where: { id: c.id }, data: { crmPersonId: personId } })
  }
  return { added, matched, review, skippedRemoved }
}
