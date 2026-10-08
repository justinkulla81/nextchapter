import 'server-only'
import { prisma } from '@/lib/prisma'
import { findEmailOwner } from './email-owner'
import { applyTemplate, describePattern, learnPatterns, type DomainPattern } from './email-pattern'
import { isHrLeaderTitle, lookupDomain, receivesMail } from './org-domains'
import { isPersonalEmail } from '@/lib/workforce/college-score'
import { siteDomain } from '@/lib/workforce/college-rank'

/** An organization counts as a university when it is typed one, linked to a college, or named like one. */
const UNIVERSITY_NAME = /\b(university|college|institute of technology|school of (business|management|law|medicine|public)|polytechnic)\b/i

const domainOf = (email: string) => email.split('@')[1]?.toLowerCase().trim() ?? ''

/**
 * Guesses addresses for people at universities who have none: each
 * organization's email domain is the one its people's real addresses use
 * (else its college's website domain), and the format is learned from every
 * real address at that domain — in the CRM and on college pages. Real
 * addresses only feed the learning; a generic inbox (careers@) never does.
 *
 * Also guesses for named college leaders whose page showed no email, and
 * clears any guess for someone whose real address has since arrived.
 */
export async function guessUniversityEmails(): Promise<{ people: number; collegeContacts: number; cleared: number; domains: number }> {
  const [crmKnown, collegeKnown] = await Promise.all([
    prisma.crmPerson.findMany({ where: { deletedAt: null, email: { not: null } }, select: { fullName: true, email: true } }),
    prisma.collegeContact.findMany({ where: { name: { not: null }, email: { not: null } }, select: { name: true, email: true } }),
  ])
  const known = [
    ...crmKnown.map((p) => ({ name: p.fullName, email: p.email! })),
    ...collegeKnown.map((c) => ({ name: c.name!, email: c.email! })),
  ].filter((k) => isPersonalEmail(k.email, k.name))
  const patterns = learnPatterns(known)

  // Real addresses by organization, to tell which domain an organization's people use.
  const orgs = await prisma.crmOrganization.findMany({
    select: {
      id: true, name: true, website: true, orgTypes: true,
      affiliations: { where: { isCurrent: true }, select: { person: { select: { id: true, fullName: true, email: true, guessedEmail: true, deletedAt: true } } } },
    },
  })
  const colleges = await prisma.localCollege.findMany({ where: { crmOrgId: { not: null } }, select: { crmOrgId: true, website: true } })
  const collegeSite = new Map(colleges.map((c) => [c.crmOrgId!, siteDomain(c.website)]))

  const orgDomain = (o: (typeof orgs)[number]): string | null => {
    // The domain most of its people's real addresses are at…
    const counts = new Map<string, number>()
    for (const a of o.affiliations) {
      const e = a.person.email
      if (e && isPersonalEmail(e, a.person.fullName)) counts.set(domainOf(e), (counts.get(domainOf(e)) ?? 0) + 1)
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    if (top) return top
    // …else its college's or its own website's, preferring a learned subdomain
    // of it (staff at cmu.edu write from andrew.cmu.edu).
    const site = collegeSite.get(o.id) ?? siteDomain(o.website)
    if (!site) return null
    if (patterns.has(site)) return site
    return [...patterns.keys()].find((d) => d.endsWith(`.${site}`)) ?? site
  }

  let people = 0
  let cleared = 0
  for (const o of orgs) {
    const isUniversity = o.orgTypes.includes('UNIVERSITY') || collegeSite.has(o.id) || UNIVERSITY_NAME.test(o.name)
    if (!isUniversity) continue
    const domain = orgDomain(o)
    const pattern = domain ? patterns.get(domain) : undefined
    for (const { person } of o.affiliations) {
      if (person.deletedAt) continue
      if (person.email) {
        if (person.guessedEmail) {
          await prisma.crmPerson.update({ where: { id: person.id }, data: { guessedEmail: null, guessedEmailBasis: null } })
          cleared++
        }
        continue
      }
      if (!domain || !pattern || person.guessedEmail) continue
      const guess = applyTemplate(pattern.template, person.fullName, domain)
      // Never guess an address that already belongs to someone else.
      if (!guess || (await findEmailOwner(guess, { includeDeleted: true }))) continue
      await prisma.crmPerson.update({
        where: { id: person.id },
        data: { guessedEmail: guess, guessedEmailBasis: `${describePattern(domain, pattern)} (${o.name})` },
      })
      people++
    }
  }

  // College leaders named on their college's site with no email shown.
  let collegeContacts = 0
  const noEmail = await prisma.collegeContact.findMany({
    where: { name: { not: null }, email: null, guessedEmail: null },
    select: { id: true, name: true, collegeId: true },
  })
  const sites = new Map((await prisma.localCollege.findMany({
    where: { id: { in: [...new Set(noEmail.map((c) => c.collegeId))] } },
    select: { id: true, website: true },
  })).map((c) => [c.id, siteDomain(c.website)]))
  for (const c of noEmail) {
    const site = sites.get(c.collegeId)
    if (!site) continue
    const domain = patterns.has(site) ? site : [...patterns.keys()].find((d) => d.endsWith(`.${site}`))
    const pattern = domain ? patterns.get(domain) : undefined
    if (!domain || !pattern) continue
    const guess = applyTemplate(pattern.template, c.name!, domain)
    if (!guess) continue
    await prisma.collegeContact.update({ where: { id: c.id }, data: { guessedEmail: guess, guessedEmailBasis: describePattern(domain, pattern) } })
    collegeContacts++
  }

  return { people, collegeContacts, cleared, domains: patterns.size }
}

const PERSONAL_DOMAINS = /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|aol|proton|protonmail|msn|comcast)\./i

/**
 * Guesses addresses for HR leaders (CHROs, chief people officers, VPs of
 * HR…) who have none. Their company's domain is found once and kept on the
 * organization: from colleagues' real addresses, its website, or a name
 * lookup checked against our name and against the domain receiving mail.
 * The format is the domain's own when we know addresses there; otherwise
 * the most common format across the companies we do know — and the basis
 * says which.
 */
export async function guessHrLeaderEmails(maxLookups = 150): Promise<{ people: number; lookedUp: number; domainsFound: number; noDomain: number }> {
  const known = (await prisma.crmPerson.findMany({ where: { deletedAt: null, email: { not: null } }, select: { fullName: true, email: true } }))
    .map((p) => ({ name: p.fullName, email: p.email! }))
    .filter((k) => isPersonalEmail(k.email, k.name) && !PERSONAL_DOMAINS.test(domainOf(k.email)) && !domainOf(k.email).endsWith('.edu'))
  const patterns = learnPatterns(known)
  // The format most companies we know use, by number of companies.
  const byTemplate = new Map<string, number>()
  for (const p of patterns.values()) byTemplate.set(p.template, (byTemplate.get(p.template) ?? 0) + 1)
  const [commonTemplate, commonCount] = [...byTemplate.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['first.last', 0]
  const common: DomainPattern = { template: commonTemplate as DomainPattern['template'], examples: 0, matching: 0 }

  const leaders = await prisma.crmPerson.findMany({
    where: { deletedAt: null, email: null, guessedEmail: null },
    select: {
      id: true, fullName: true,
      affiliations: {
        where: { isCurrent: true },
        select: {
          title: true,
          org: {
            select: {
              id: true, name: true, website: true, emailDomain: true, emailDomainCheckedAt: true,
              affiliations: { where: { isCurrent: true }, select: { person: { select: { fullName: true, email: true } } } },
            },
          },
        },
      },
    },
  })

  let people = 0
  let lookedUp = 0
  let domainsFound = 0
  let noDomain = 0
  const recheckBefore = new Date(Date.now() - 90 * 86_400_000)
  for (const p of leaders) {
    const aff = p.affiliations.find((a) => isHrLeaderTitle(a.title))
    if (!aff) continue
    const org = aff.org
    let domain = org.emailDomain
    if (!domain && (!org.emailDomainCheckedAt || org.emailDomainCheckedAt < recheckBefore)) {
      let source: string | null = null
      // Colleagues' real addresses first.
      const counts = new Map<string, number>()
      for (const a of org.affiliations) {
        const e = a.person.email
        if (e && isPersonalEmail(e, a.person.fullName) && !PERSONAL_DOMAINS.test(domainOf(e))) counts.set(domainOf(e), (counts.get(domainOf(e)) ?? 0) + 1)
      }
      domain = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      if (domain) source = 'people'
      if (!domain && org.website) {
        domain = siteDomain(org.website)
        if (domain) source = 'website'
      }
      if (!domain && lookedUp < maxLookups) {
        lookedUp++
        const found = await lookupDomain(org.name).catch(() => null)
        if (found && (await receivesMail(found))) { domain = found; source = 'lookup' }
      }
      await prisma.crmOrganization.update({
        where: { id: org.id },
        data: { emailDomain: domain, emailDomainSource: source, emailDomainCheckedAt: new Date() },
      })
      if (domain) domainsFound++
    }
    if (!domain) { noDomain++; continue }

    const own = patterns.get(domain)
    const pattern = own ?? common
    const guess = applyTemplate(pattern.template, p.fullName, domain)
    if (!guess || (await findEmailOwner(guess, { includeDeleted: true }))) continue
    const basis = own
      ? `${describePattern(domain, own)} (${org.name})`
      : `${pattern.template} — no addresses known at ${domain} yet; it is the most common format across ${commonCount} companies we have addresses for (${org.name})`
    await prisma.crmPerson.update({ where: { id: p.id }, data: { guessedEmail: guess, guessedEmailBasis: basis } })
    people++
  }
  return { people, lookedUp, domainsFound, noDomain }
}
