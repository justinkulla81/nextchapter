/**
 * Makes sure every firm behind a /search-firms page is a CRM organization that says so. Dry run unless --apply.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/search-firms/crm-backfill.ts [--apply]
 *
 * 1. A SearchFirm whose CRM organization lacks the SEARCH_FIRM type gets the type (nothing else changes).
 * 2. A staffing Company (industry 'Staffing & Human Capital') with no CRM organization is matched with the same rules as the
 *    search-firm sync (matchFirmToOrgs): an exact name or domain match is linked (companyId set, SEARCH_FIRM added);
 *    a near match is NEVER guessed — it is printed under REVIEW for the owner to merge on the CRM Review List; no match
 *    creates a new SEARCH_FIRM organization linked to the company.
 */
import { prisma } from '../../src/lib/prisma'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'
import { domainOf, matchFirmToOrgs, type OrgForMatch } from '../../src/lib/search-firms/match'
import { STAFFING_INDUSTRY } from '../../src/lib/seo/search-firm-link'

async function main() {
  const apply = process.argv.includes('--apply')
  const tally = { typeAdded: 0, linked: 0, created: 0, review: 0 }

  const untyped = await prisma.searchFirm.findMany({
    where: { crmOrgId: { not: null }, crmOrg: { NOT: { orgTypes: { has: 'SEARCH_FIRM' } } } },
    select: { name: true, crmOrg: { select: { id: true, name: true, orgTypes: true } } },
  })
  for (const f of untyped) {
    console.log(`type  ${f.name} -> ${f.crmOrg!.name} [${f.crmOrg!.orgTypes.join(',')}]`)
    if (apply) await prisma.crmOrganization.update({ where: { id: f.crmOrg!.id }, data: { orgTypes: { push: 'SEARCH_FIRM' } } })
    tally.typeAdded++
  }

  const orgs: OrgForMatch[] = await prisma.crmOrganization.findMany({ select: { id: true, name: true, website: true, emailDomain: true } })
  const companies = await prisma.company.findMany({
    where: { industry: STAFFING_INDUSTRY, crmOrganizations: { none: {} } },
    select: { id: true, name: true, website: true },
  })
  for (const c of companies) {
    const m = matchFirmToOrgs({ name: c.name, website: c.website, domain: domainOf(c.website) }, orgs)
    if (m.kind === 'review') {
      console.log(`REVIEW ${c.name}: ${m.reason} (org ${m.orgId}) — merge on the CRM Review List; not linked`)
      tally.review++
    } else if (m.kind === 'matched') {
      const org = await prisma.crmOrganization.findUniqueOrThrow({ where: { id: m.orgId }, select: { companyId: true, orgTypes: true } })
      if (org.companyId && org.companyId !== c.id) { console.log(`REVIEW ${c.name}: matched org already has another company — not linked`); tally.review++; continue }
      console.log(`link  ${c.name} -> org ${m.orgId} (${m.basis})`)
      if (apply) await prisma.crmOrganization.update({ where: { id: m.orgId }, data: { companyId: c.id, orgTypes: [...new Set([...org.orgTypes, 'SEARCH_FIRM' as const])] } })
      tally.linked++
    } else {
      console.log(`new   ${c.name}`)
      if (apply) {
        const domain = domainOf(c.website)
        const created = await prisma.crmOrganization.create({
          data: { name: c.name, canonicalNameNormalized: normalizeOrgName(c.name), orgTypes: ['SEARCH_FIRM'], website: c.website, emailDomain: domain, emailDomainSource: domain ? 'website' : null, emailDomainCheckedAt: domain ? new Date() : null, companyId: c.id },
          select: { id: true },
        })
        orgs.push({ id: created.id, name: c.name, website: c.website, emailDomain: domain })
      }
      tally.created++
    }
  }
  console.log(apply ? 'APPLIED' : 'DRY RUN (add --apply)', tally)
}

main().finally(() => prisma.$disconnect())
