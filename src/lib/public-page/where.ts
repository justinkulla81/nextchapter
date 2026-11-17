import 'server-only'
import { prisma } from '@/lib/prisma'
import { claimSlug, SITE_URL } from '@/lib/org-claims/urls'
import { orgKitContext } from '@/lib/org-claims/org-kit-data'

// The organization's public page address, for the editor's "Your page" link (the launch kit already maps a claim address
// to the page). Null when it has none.
export async function publicPageUrlFor(crmOrgId: string | null | undefined): Promise<string | null> {
  if (!crmOrgId) return null
  const org = await prisma.crmOrganization.findUnique({ where: { id: crmOrgId }, select: { canonicalNameNormalized: true } })
  const slug = org ? claimSlug(org.canonicalNameNormalized) : null
  if (!slug) return null
  const kit = await orgKitContext(slug).catch(() => null)
  return kit ? `${SITE_URL}${kit.pagePath}` : null
}
