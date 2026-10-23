import 'server-only'
import { prisma } from '@/lib/prisma'
import { canonicalFromSlug, orgSlug } from '@/lib/crm/org-slug'
import { PROSPECTS } from '@/lib/prospects/config'

export interface ClaimableOrg {
  id: string
  name: string
  slug: string
  emailDomain: string | null
  orgTypes: string[]
}

/**
 * The CRM organization a /prepared/<slug> address stands for. The three hand-built prospects are never resolved here,
 * and a slug only counts when the organization's own slug is exactly it.
 */
export async function resolveClaimableOrg(slug: string): Promise<ClaimableOrg | null> {
  if (PROSPECTS[slug] || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null
  const org = await prisma.crmOrganization.findUnique({
    where: { canonicalNameNormalized: canonicalFromSlug(slug) },
    select: { id: true, name: true, canonicalNameNormalized: true, emailDomain: true, orgTypes: true },
  })
  if (!org || orgSlug(org.canonicalNameNormalized) !== slug) return null
  return { id: org.id, name: org.name, slug, emailDomain: org.emailDomain, orgTypes: org.orgTypes }
}
