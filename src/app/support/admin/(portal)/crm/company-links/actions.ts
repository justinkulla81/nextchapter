'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { cleanWebsite } from '@/lib/companies/company-links'

const BASE = '/support/admin/crm/company-links'

/** Confirms a CRM organisation and a directory company are the same business. */
export async function linkOrganizationToCompany(formData: FormData): Promise<void> {
  await requireAdmin()
  const orgId = String(formData.get('orgId') ?? '')
  const companyId = String(formData.get('companyId') ?? '')
  if (!orgId || !companyId) return

  const [org, company] = await Promise.all([
    prisma.crmOrganization.findUnique({ where: { id: orgId }, select: { id: true, website: true } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { id: true, website: true } }),
  ])
  if (!org || !company) return

  await prisma.crmOrganization.update({ where: { id: orgId }, data: { companyId, companyLinkState: 'ADMIN' } })

  // The linked organisation's typed website is the best source we have for the
  // company's own — fill it only if the company has none.
  const website = cleanWebsite(org.website)
  if (website && !company.website) {
    await prisma.company.update({ where: { id: companyId }, data: { website, websiteSource: 'crm' } })
  }
  revalidatePath(BASE)
}

/** Records that this organisation and these suggested companies are different businesses. */
export async function keepOrganizationSeparate(formData: FormData): Promise<void> {
  await requireAdmin()
  const orgId = String(formData.get('orgId') ?? '')
  if (!orgId) return
  await prisma.crmOrganization.update({ where: { id: orgId }, data: { companyLinkState: 'KEPT_SEPARATE' } })
  revalidatePath(BASE)
}
