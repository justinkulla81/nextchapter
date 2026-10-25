import 'server-only'
import { prisma } from '@/lib/prisma'
import { canonicalCandidates, claimSlug, isSlugOverride } from '@/lib/org-claims/urls'
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
  const found = await prisma.crmOrganization.findMany({
    where: { canonicalNameNormalized: { in: canonicalCandidates(slug) } },
    select: { id: true, name: true, canonicalNameNormalized: true, emailDomain: true, orgTypes: true },
  })
  // Two stored names that read to the same address ('a and b', 'a & b') are ambiguous: neither gets a page.
  let matches = found.filter((o) => claimSlug(o.canonicalNameNormalized) === slug)
  // A hand-picked address wins over a name that merely reads the same.
  if (matches.length > 1) matches = matches.filter((o) => isSlugOverride(o.canonicalNameNormalized))
  if (matches.length !== 1) return null
  const org = matches[0]
  return { id: org.id, name: org.name, slug, emailDomain: org.emailDomain, orgTypes: org.orgTypes }
}
