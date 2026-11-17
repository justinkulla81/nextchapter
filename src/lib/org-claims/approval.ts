import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { provisionFreeWorkspace } from '@/lib/plans/provision'
import { orgSlug } from '@/lib/crm/org-slug'
import { FREE_WORKSPACE_TYPES, freeWorkspaceType } from './claim'

// Owner decision 2026-11-17: organizations claim their page themselves with a verified work email, and NextChapter
// approves each claim before the free workspace is created. The queue is /support/admin/organizations/claims.

export type PendingClaim = {
  id: string
  name: string
  title: string
  email: string
  emailDomain: string
  needsReview: boolean
  verifiedAt: Date
  orgId: string
  orgName: string
  orgSlug: string | null
  orgTypes: string[]
  orgDomain: string | null
  hasWorkspace: boolean
}

// Verified claims for a type with a free workspace that nobody has approved or declined yet. Bounded: the queue is short.
export async function pendingClaims(): Promise<PendingClaim[]> {
  const rows = await prisma.orgClaim.findMany({
    where: { verifiedAt: { not: null }, approvedAt: null, declinedAt: null, section: null, crmOrganization: { orgTypes: { hasSome: FREE_WORKSPACE_TYPES as never[] } } },
    orderBy: { verifiedAt: 'asc' },
    take: 100,
    select: {
      id: true, name: true, title: true, email: true, emailDomain: true, needsReview: true, verifiedAt: true, crmOrganizationId: true,
      crmOrganization: { select: { name: true, canonicalNameNormalized: true, orgTypes: true, emailDomain: true } },
    },
  })
  const orgIds = rows.map((r) => r.crmOrganizationId)
  const withWorkspace = new Set(
    orgIds.length ? (await prisma.institution.findMany({ where: { crmOrganizationId: { in: orgIds } }, select: { crmOrganizationId: true } })).map((i) => i.crmOrganizationId) : [],
  )
  return rows.map((r) => ({
    id: r.id, name: r.name, title: r.title, email: r.email, emailDomain: r.emailDomain, needsReview: r.needsReview, verifiedAt: r.verifiedAt as Date,
    orgId: r.crmOrganizationId, orgName: r.crmOrganization.name, orgSlug: orgSlug(r.crmOrganization.canonicalNameNormalized),
    orgTypes: r.crmOrganization.orgTypes.map(String), orgDomain: r.crmOrganization.emailDomain ?? null, hasWorkspace: withWorkspace.has(r.crmOrganizationId),
  }))
}

export type DecisionResult = { ok: true; slug?: string } | { ok: false; error: string }

async function loadOpen(claimId: string) {
  return prisma.orgClaim.findUnique({
    where: { id: claimId },
    select: { id: true, email: true, verifiedAt: true, approvedAt: true, declinedAt: true, crmOrganizationId: true, crmOrganization: { select: { name: true, orgTypes: true } } },
  })
}

// Approve: create the free workspace (or reuse it) with the claimant as its administrator. provisionFreeWorkspace sends the
// sign-in email. The claim is marked approved only once the workspace exists, so a failure can simply be retried.
export async function approveOrgClaim(claimId: string, adminEmail: string): Promise<DecisionResult> {
  const claim = await loadOpen(claimId)
  if (!claim || !claim.verifiedAt) return { ok: false, error: 'This claim was not found or its email was never confirmed.' }
  if (claim.approvedAt) return { ok: false, error: 'This claim is already approved.' }
  if (claim.declinedAt) return { ok: false, error: 'This claim was declined. Ask them to claim the page again if that was a mistake.' }
  const type = freeWorkspaceType(claim.crmOrganization.orgTypes.map(String))
  if (!type) return { ok: false, error: 'This kind of organization has no free workspace, so there is nothing to approve.' }
  const r = await provisionFreeWorkspace({ crmOrganizationId: claim.crmOrganizationId, name: claim.crmOrganization.name, orgType: type, claimantEmail: claim.email })
  if (!r.ok) return { ok: false, error: r.error }
  await prisma.orgClaim.update({ where: { id: claim.id }, data: { approvedAt: new Date(), approvedBy: adminEmail } })
  captureServerEvent(`org-claim:${claim.crmOrganizationId}`, 'org_claim_approved', { orgId: claim.crmOrganizationId, claimId: claim.id, orgType: type, institutionId: r.institutionId, workspaceCreated: r.created })
  return { ok: true, slug: r.slug }
}

// Decline: nothing is created. The claimant stays in the CRM as a lead.
export async function declineOrgClaim(claimId: string, adminEmail: string): Promise<DecisionResult> {
  const claim = await loadOpen(claimId)
  if (!claim) return { ok: false, error: 'This claim was not found.' }
  if (claim.approvedAt) return { ok: false, error: 'This claim is already approved, so it cannot be declined here.' }
  if (claim.declinedAt) return { ok: true }
  await prisma.orgClaim.update({ where: { id: claim.id }, data: { declinedAt: new Date(), declinedBy: adminEmail } })
  captureServerEvent(`org-claim:${claim.crmOrganizationId}`, 'org_claim_declined', { orgId: claim.crmOrganizationId, claimId: claim.id })
  return { ok: true }
}
