import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { strictOrgKey } from '@/lib/crm/normalize'

/**
 * Whenever a CHRO contact is saved on a Company (see
 * updateCompanyChroContact in crm/warn/actions.ts), mirrors it into the
 * People CRM — a name typed into a text field on the Layoff notices page is
 * not itself a working lead; a CrmPerson with a CHRO_HR role, showing up in
 * the People queue, is. Also backfills CrmOrganization.companyId when a
 * matching org already exists but was never linked back to this Company —
 * the same seam promoteNotice() left open when it creates CrmOrganization
 * rows independently of the Company table.
 */
export async function syncChroContactToCrm(companyId: string): Promise<void> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { name: true, chroName: true, chroEmail: true, chroLinkedinUrl: true },
  })
  if (!company.chroName) return

  let org = await prisma.crmOrganization.findFirst({ where: { companyId } })
  if (!org) {
    const strictKey = strictOrgKey(company.name, normalizeOrgName)
    const all = await prisma.crmOrganization.findMany({ select: { id: true, name: true } })
    const match = all.find((o) => strictOrgKey(o.name, normalizeOrgName) === strictKey)
    org = match
      ? await prisma.crmOrganization.update({ where: { id: match.id }, data: { companyId } })
      : await prisma.crmOrganization.create({
          data: { name: company.name, canonicalNameNormalized: normalizeOrgName(company.name), companyId, orgTypes: ['EMPLOYER'] },
        })
  }

  const person = company.chroEmail
    ? await prisma.crmPerson.findFirst({ where: { OR: [{ email: company.chroEmail }, { emails: { has: company.chroEmail } }] } })
    : await prisma.crmPerson.findFirst({ where: { fullName: company.chroName } })

  const personId = person
    ? person.id
    : (
        await prisma.crmPerson.create({
          data: {
            fullName: company.chroName,
            email: company.chroEmail || null,
            emails: company.chroEmail ? [company.chroEmail] : [],
            linkedinUrl: company.chroLinkedinUrl || null,
            roles: ['CHRO_HR'],
            normalizedKey: `${company.chroName.trim().toLowerCase()}|${normalizeOrgName(company.name)}`,
          },
        })
      ).id

  if (person && !person.roles.includes('CHRO_HR')) {
    await prisma.crmPerson.update({ where: { id: personId }, data: { roles: { push: 'CHRO_HR' } } })
  }
  if (person && company.chroLinkedinUrl && !person.linkedinUrl) {
    await prisma.crmPerson.update({ where: { id: personId }, data: { linkedinUrl: company.chroLinkedinUrl } })
  }

  await prisma.crmAffiliation.upsert({
    where: { personId_orgId_title: { personId, orgId: org.id, title: 'CHRO' } },
    update: { isPrimary: true, isCurrent: true },
    create: { personId, orgId: org.id, title: 'CHRO', isPrimary: true, isCurrent: true },
  })
}
