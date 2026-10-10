import 'server-only'
import { prisma } from '@/lib/prisma'
import { addContactToCrm } from '@/lib/crm/add-contact'
import { findEmailOwner } from '@/lib/crm/email-owner'
import { applyTemplate, describePattern, learnPatterns, type DomainPattern } from '@/lib/crm/email-pattern'
import { isPersonalEmail } from '@/lib/workforce/college-score'
import { cleanPersonName } from '@/lib/workforce/college-crm'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { contactRank, matchFirmToOrgs, segmentFor, type OrgForMatch } from './match'

/** One firm as scripts/search-firms/export-firms.py writes it. */
export interface FirmRecord {
  sourceKey: string
  name: string
  website: string | null
  domain: string | null
  segmentHint?: string | null
  liveSearchCount: number
  sampleTitles: string[]
}

/** People read off a firm's own public team page, checked against the page's HTML. */
export interface TeamRecord {
  sourceId: string
  domain: string | null
  teamPageUrl: string | null
  people: { name: string; title: string; email: string | null; sourceUrl: string }[]
  emailsSeen: { name: string; email: string }[]
}

/** Search firms are partnerships — they send searches; we send shortlists. */
const FIRM_GOALS = ['BD'] as const
const FIRM_ROLES = ['BD_PARTNER'] as const

/**
 * Brings each firm into the CRM: an organization with the same name or domain
 * is that firm (it gains the SEARCH_FIRM type and the BD goal); a similarly
 * named one is left for the Review List; otherwise a new organization is
 * added. A firm already decided on the Review List is never re-matched.
 */
export async function syncSearchFirms(firms: FirmRecord[]): Promise<{ matched: number; added: number; review: number }> {
  const orgs: OrgForMatch[] = await prisma.crmOrganization.findMany({ select: { id: true, name: true, website: true, emailDomain: true } })
  const existing = new Map((await prisma.searchFirm.findMany({ select: { sourceKey: true, crmOrgId: true, matchStatus: true } })).map((f) => [f.sourceKey, f]))
  const out = { matched: 0, added: 0, review: 0 }

  for (const f of firms) {
    const data = {
      name: f.name, website: f.website, domain: f.domain,
      segment: segmentFor(f.sourceKey, f.name, f.segmentHint),
      liveSearchCount: f.liveSearchCount, sampleTitles: f.sampleTitles, lastSyncedAt: new Date(),
    }
    const prior = existing.get(f.sourceKey)
    if (prior && (prior.crmOrgId || prior.matchStatus === 'REVIEW')) {
      await prisma.searchFirm.update({ where: { sourceKey: f.sourceKey }, data })
      if (prior.crmOrgId) out[prior.matchStatus === 'ADDED' ? 'added' : 'matched']++
      else out.review++
      continue
    }

    const m = matchFirmToOrgs(f, orgs)
    if (m.kind === 'review') {
      await prisma.searchFirm.upsert({
        where: { sourceKey: f.sourceKey },
        create: { sourceKey: f.sourceKey, ...data, matchStatus: 'REVIEW', reviewOrgId: m.orgId, reviewReason: m.reason },
        update: { ...data, matchStatus: 'REVIEW', reviewOrgId: m.orgId, reviewReason: m.reason },
      })
      out.review++
      continue
    }
    const orgId = m.kind === 'matched' ? await tagFirmOrg(m.orgId) : (await createFirmOrg(f)).id
    if (m.kind === 'none') orgs.push({ id: orgId, name: f.name, website: f.website, emailDomain: f.domain })
    const matchStatus = m.kind === 'matched' ? 'MATCHED' : 'ADDED'
    await prisma.searchFirm.upsert({
      where: { sourceKey: f.sourceKey },
      create: { sourceKey: f.sourceKey, ...data, crmOrgId: orgId, matchStatus },
      update: { ...data, crmOrgId: orgId, matchStatus, reviewOrgId: null, reviewReason: null },
    })
    out[m.kind === 'matched' ? 'matched' : 'added']++
  }
  return out
}

/** Marks an existing organization a search firm with the BD goal. */
export async function tagFirmOrg(orgId: string): Promise<string> {
  const org = await prisma.crmOrganization.findUniqueOrThrow({ where: { id: orgId }, select: { orgTypes: true, goals: true } })
  if (!org.orgTypes.includes('SEARCH_FIRM') || !org.goals.includes('BD')) {
    await prisma.crmOrganization.update({
      where: { id: orgId },
      data: {
        orgTypes: [...new Set([...org.orgTypes, 'SEARCH_FIRM' as const])],
        goals: [...new Set([...org.goals, ...FIRM_GOALS])],
      },
    })
  }
  return orgId
}

export async function createFirmOrg(f: { name: string; website: string | null; domain: string | null }): Promise<{ id: string }> {
  const canonical = normalizeOrgName(f.name)
  // Same canonical name: the matcher should have found it, but never create a second one.
  const same = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: canonical }, select: { id: true } })
  if (same) return { id: await tagFirmOrg(same.id) }
  return prisma.crmOrganization.create({
    data: {
      name: f.name, canonicalNameNormalized: canonical, orgTypes: ['SEARCH_FIRM'], goals: [...FIRM_GOALS],
      website: f.website, emailDomain: f.domain, emailDomainSource: f.domain ? 'website' : null,
      emailDomainCheckedAt: f.domain ? new Date() : null,
      notes: 'Search firm — added for search-firm outreach (send us your searches; we return a screened shortlist).',
    },
    select: { id: true },
  })
}

/**
 * Adds the people read off each firm's own team page, at P2 with the BD goal,
 * through the same addContactToCrm every contact path uses (an email already
 * in the CRM is that person; a same-name match goes to the Review List).
 * A real address is used only when the page printed it next to the person;
 * otherwise an address is guessed from the firm's format and stored as a
 * guess with its basis — never as the email.
 */
export async function addTeamPeople(teams: TeamRecord[]): Promise<{ added: number; matched: number; review: number; removed: number; real: number; guessed: number; skippedNoOrg: number; skippedTitle: number }> {
  const out = { added: 0, matched: 0, review: 0, removed: 0, real: 0, guessed: 0, skippedNoOrg: 0, skippedTitle: 0 }
  // One person listed by two firms (a firm and the group that bought it) is added once.
  const done = new Set<string>()
  const known = (await prisma.crmPerson.findMany({ where: { deletedAt: null, email: { not: null } }, select: { fullName: true, email: true } }))
    .map((p) => ({ name: p.fullName, email: p.email! }))
  const seen = teams.flatMap((t) => t.emailsSeen.map((e) => ({ name: e.name, email: e.email })))
  const patterns = learnPatterns([...known, ...seen].filter((k) => isPersonalEmail(k.email, k.name)))
  // The format most companies use, for a firm whose own format is unknown.
  const byTemplate = new Map<string, number>()
  for (const p of patterns.values()) byTemplate.set(p.template, (byTemplate.get(p.template) ?? 0) + 1)
  const [commonTemplate, commonCount] = [...byTemplate.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['first.last', 0]

  for (const t of teams) {
    const firm = await prisma.searchFirm.findUnique({ where: { sourceKey: t.sourceId }, select: { id: true, name: true, crmOrgId: true } })
    if (!firm?.crmOrgId) { out.skippedNoOrg += t.people.length; continue }
    if (t.teamPageUrl) await prisma.searchFirm.update({ where: { id: firm.id }, data: { teamPageUrl: t.teamPageUrl } })
    const domain = t.domain
    const own: DomainPattern | undefined = domain ? patterns.get(domain) : undefined

    for (const p of t.people) {
      const name = cleanPersonName(p.name.split(',')[0].replace(/["“”][^"“”]*["“”]/g, ' '))
      // A CFO or chief people officer runs the firm, not its searches.
      if (contactRank(p.title) < 0) { out.skippedTitle++; continue }
      if (done.has(name.toLowerCase())) continue
      done.add(name.toLowerCase())
      let guessedEmail: string | null = null
      let guessedEmailBasis: string | null = null
      if (!p.email && domain) {
        const template = (own?.template ?? commonTemplate) as DomainPattern['template']
        const g = applyTemplate(template, name, domain)
        if (g && !(await findEmailOwner(g, { includeDeleted: true }))) {
          guessedEmail = g
          guessedEmailBasis = own
            ? `${describePattern(domain, own)} (${firm.name})`
            : `${template} — no addresses known at ${domain} yet; it is the most common format across ${commonCount} companies we have addresses for (${firm.name})`
        }
      }
      const r = await addContactToCrm({
        fullName: name, title: p.title, email: p.email?.toLowerCase() ?? null, guessedEmail, guessedEmailBasis,
        orgId: firm.crmOrgId, orgName: firm.name, roles: [...FIRM_ROLES], goals: [...FIRM_GOALS], priority: 'P2',
        note: `${p.title} at ${firm.name}. Name and title from the firm's own team page: ${p.sourceUrl}${p.email ? '' : guessedEmail ? ' No address was published; the email shown is a guess from the firm\'s format.' : ''}`,
      })
      if (r.outcome === 'removed') { out.removed++; continue }
      out[r.outcome]++
      if (p.email) out.real++
      else if (guessedEmail) out.guessed++
    }
  }
  return out
}

/** Review List: the firm is the organization suggested — link it. */
export async function resolveFirmAsSame(firmId: string): Promise<void> {
  const firm = await prisma.searchFirm.findUniqueOrThrow({ where: { id: firmId }, select: { reviewOrgId: true } })
  if (!firm.reviewOrgId) throw new Error('This firm has no suggested organization to link.')
  await tagFirmOrg(firm.reviewOrgId)
  await prisma.searchFirm.update({ where: { id: firmId }, data: { crmOrgId: firm.reviewOrgId, matchStatus: 'MATCHED', reviewOrgId: null, reviewReason: null } })
}

/** Review List: a different organization — add the firm as its own. */
export async function resolveFirmAsDifferent(firmId: string): Promise<void> {
  const firm = await prisma.searchFirm.findUniqueOrThrow({ where: { id: firmId }, select: { name: true, website: true, domain: true } })
  const canonical = normalizeOrgName(firm.name)
  const clash = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: canonical }, select: { id: true } })
  // The canonical name is unique; if it is taken, that org IS this name — link instead of failing.
  const org = clash ? { id: await tagFirmOrg(clash.id) } : await createFirmOrg(firm)
  await prisma.searchFirm.update({ where: { id: firmId }, data: { crmOrgId: org.id, matchStatus: 'ADDED', reviewOrgId: null, reviewReason: null } })
}
