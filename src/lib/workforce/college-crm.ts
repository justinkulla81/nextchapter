import 'server-only'
import { prisma } from '@/lib/prisma'
import { addContactToCrm } from '@/lib/crm/add-contact'
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
 * title and their own address (not careers@, giving@ or advancementvp@) — a
 * real one, or one worked out from the college's email format. Every ranked
 * four-year college counts; a college ranked A or B is P2, the rest carry no
 * priority.
 */
export function crmWorthy(c: { role: string; name: string | null; title: string | null; email: string | null; guessedEmail?: string | null }): boolean {
  return !!c.name && titleLeadsRole(c.title, c.role) && (isPersonalEmail(c.email, c.name) || (!c.email && isPersonalEmail(c.guessedEmail ?? null, c.name)))
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
export async function addCollegeContactsToCrm(budgetMs = 120_000): Promise<{ added: number; matched: number; review: number; skippedRemoved: number }> {
  const started = Date.now()
  const contacts = await prisma.collegeContact.findMany({
    where: { crmPersonId: null, name: { not: null }, OR: [{ email: { not: null } }, { guessedEmail: { not: null } }] },
  })
  const colleges = new Map((await prisma.localCollege.findMany({
    where: { id: { in: [...new Set(contacts.map((c) => c.collegeId))] } },
    select: { id: true, name: true, tier: true, rank: true, website: true, city: true, state: true },
  })).map((c) => [c.id, c]))
  const worthy = contacts.filter((c) => crmWorthy(c))
    // Ranked colleges first, so a short budget covers the ones that matter.
    .sort((a, b) => (colleges.get(a.collegeId)?.rank ?? 1e9) - (colleges.get(b.collegeId)?.rank ?? 1e9))

  const orgByKey = await orgsByKey()
  const out = { added: 0, matched: 0, review: 0, skippedRemoved: 0 }
  for (const c of worthy) {
    if (Date.now() - started > budgetMs) break
    const college = colleges.get(c.collegeId)!
    const name = cleanPersonName(c.name!)
    const title = c.title ?? COLLEGE_ROLES[c.role as CollegeRole]?.label ?? null
    const org = await ensureCollegeOrg(college, orgByKey)
    const guessed = !c.email
    const r = await addContactToCrm({
      fullName: name,
      title,
      email: c.email,
      guessedEmail: c.guessedEmail,
      guessedEmailBasis: c.guessedEmailBasis,
      phone: c.phone,
      orgId: org.id,
      orgName: college.name,
      roles: ['ALUMNI_OFFICE'],
      goals: [...COLLEGE_GOALS],
      priority: college.tier === 'A' || college.tier === 'B' ? 'P2' : null,
      note: `${title ?? 'Leader'} at ${college.name}${college.rank ? ` (college rank ${college.rank}, tier ${college.tier})` : ''}. From the college's own website: ${c.sourceUrl}${guessed ? ' No address was published; the email shown is a guess from the college\'s format.' : ''}`,
    })
    if (r.outcome === 'removed') { out.skippedRemoved++; continue }
    if (r.outcome === 'added') out.added++
    else if (r.outcome === 'matched') out.matched++
    else out.review++
    await prisma.collegeContact.update({ where: { id: c.id }, data: { crmPersonId: r.personId } })
  }
  return out
}
