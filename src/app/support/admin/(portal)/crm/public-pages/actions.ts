'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { sourceRowFor } from '@/lib/seo/org-page-links'

/** Review List: a public page's organization is the CRM organization suggested for it. */
export async function linkPublicPageToSuggestedOrg(kind: string, sourceId: string): Promise<void> {
  const admin = await requireAdmin()
  const link = await prisma.publicOrgPage.findUnique({ where: { kind_sourceId: { kind, sourceId } } })
  if (!link?.reviewOrgId) return
  await prisma.publicOrgPage.update({ where: { kind_sourceId: { kind, sourceId } }, data: { crmOrgId: link.reviewOrgId, matchStatus: 'LINKED', reviewOrgId: null, reviewReason: null } })
  captureServerEvent(admin.email ?? 'admin', 'public_page_match_resolved', { kind, sourceId, decision: 'same' })
  revalidatePath('/support/admin/crm/needs-completion')
}

/** Review List: different organizations — add the public page's organization as its own CRM record. */
export async function addPublicPageAsNewOrg(kind: string, sourceId: string): Promise<void> {
  const admin = await requireAdmin()
  const link = await prisma.publicOrgPage.findUnique({ where: { kind_sourceId: { kind, sourceId } } })
  if (!link) return
  const src = await sourceRowFor(kind, link.state, sourceId)
  if (!src) return
  const canonical = normalizeOrgName(src.crmName)
  const org = await prisma.crmOrganization.upsert({
    where: { canonicalNameNormalized: canonical },
    update: {},
    create: { name: src.crmName, canonicalNameNormalized: canonical, orgTypes: ['GOVERNMENT'], website: src.row.website, hqCity: src.row.city, hqRegion: link.state, usState: link.state },
    select: { id: true },
  })
  await prisma.publicOrgPage.update({ where: { kind_sourceId: { kind, sourceId } }, data: { crmOrgId: org.id, matchStatus: 'CREATED', reviewOrgId: null, reviewReason: null } })
  captureServerEvent(admin.email ?? 'admin', 'public_page_match_resolved', { kind, sourceId, decision: 'different' })
  revalidatePath('/support/admin/crm/needs-completion')
}
