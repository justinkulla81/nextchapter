import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { provisionFreeWorkspace } from '@/lib/plans/provision'
import { orgSlug } from '@/lib/crm/org-slug'
import { FREE_WORKSPACE_TYPES, freeWorkspaceType } from './claim'
import { applySectionClaim } from './section-claim'
import { connectRelated } from './related-orgs'
import { cleanDomain } from './rules'
import { employerSection, isEmployerSectionKey, type EmployerSectionKey } from '@/lib/employer/sections'
import { sendHiringClaimApprovedEmail } from '@/lib/email/send-org-claim-email'
import { urlForAppPath } from '@/lib/portal-hosts'

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
  /** Hiring, Employees or Outplacement for an employer's section claim; null for a whole-page claim. */
  section: EmployerSectionKey | null
  /** The organization whose related-organization invite the claimant came from. */
  invitedBy: string | null
}

// Verified claims for a type with a free workspace that nobody has approved or declined yet. Bounded: the queue is short.
export async function pendingClaims(): Promise<PendingClaim[]> {
  const rows = await prisma.orgClaim.findMany({
    where: {
      verifiedAt: { not: null }, approvedAt: null, declinedAt: null,
      OR: [
        { section: null, crmOrganization: { orgTypes: { hasSome: FREE_WORKSPACE_TYPES as never[] } } },
        // An employer's section claim where the claimant holds the section (or it waits for review): the owner approves it.
        { section: { not: null }, outcome: { in: ['ADMIN', 'REVIEW'] }, crmOrganization: { orgTypes: { has: 'EMPLOYER' as never } } },
      ],
    },
    orderBy: { verifiedAt: 'asc' },
    take: 100,
    select: {
      id: true, name: true, title: true, email: true, emailDomain: true, needsReview: true, verifiedAt: true, crmOrganizationId: true, section: true, referredByPartnerId: true,
      crmOrganization: { select: { name: true, canonicalNameNormalized: true, orgTypes: true, emailDomain: true } },
    },
  })
  const orgIds = rows.map((r) => r.crmOrganizationId)
  const refIds = rows.map((r) => r.referredByPartnerId).filter((x): x is string => !!x)
  const inviters = new Map(
    refIds.length ? (await prisma.ecosystemPartner.findMany({ where: { id: { in: refIds } }, select: { id: true, institution: { select: { name: true } } } })).map((p) => [p.id, p.institution.name]) : [],
  )
  // An employer's own invite carries its row id the same way.
  const employerRefs = refIds.filter((id) => !inviters.has(id))
  if (employerRefs.length) {
    for (const e of await prisma.employerRelatedOrg.findMany({ where: { id: { in: employerRefs } }, select: { id: true, employerProfile: { select: { companyName: true } } } })) inviters.set(e.id, e.employerProfile.companyName)
  }
  const withWorkspace = new Set(
    orgIds.length ? (await prisma.institution.findMany({ where: { crmOrganizationId: { in: orgIds } }, select: { crmOrganizationId: true } })).map((i) => i.crmOrganizationId) : [],
  )
  return rows.map((r) => ({
    id: r.id, name: r.name, title: r.title, email: r.email, emailDomain: r.emailDomain, needsReview: r.needsReview, verifiedAt: r.verifiedAt as Date,
    orgId: r.crmOrganizationId, orgName: r.crmOrganization.name, orgSlug: orgSlug(r.crmOrganization.canonicalNameNormalized),
    orgTypes: r.crmOrganization.orgTypes.map(String), orgDomain: r.crmOrganization.emailDomain ?? null, hasWorkspace: withWorkspace.has(r.crmOrganizationId),
    section: isEmployerSectionKey(r.section) ? r.section : null,
    invitedBy: r.referredByPartnerId ? (inviters.get(r.referredByPartnerId) ?? null) : null,
  }))
}

export type DecisionResult = { ok: true; slug?: string } | { ok: false; error: string }

async function loadOpen(claimId: string) {
  return prisma.orgClaim.findUnique({
    where: { id: claimId },
    select: {
      id: true, name: true, title: true, email: true, emailDomain: true, needsReview: true, verifiedAt: true, approvedAt: true, declinedAt: true, crmOrganizationId: true, section: true, outcome: true, referredByPartnerId: true,
      crmOrganization: { select: { name: true, orgTypes: true, emailDomain: true } },
    },
  })
}

// Approve: create the free workspace (or reuse it) with the claimant as its administrator. provisionFreeWorkspace sends the
// sign-in email. The claim is marked approved only once the workspace exists, so a failure can simply be retried.
export async function approveOrgClaim(claimId: string, adminEmail: string): Promise<DecisionResult> {
  const claim = await loadOpen(claimId)
  if (!claim || !claim.verifiedAt) return { ok: false, error: 'This claim was not found or its email was never confirmed.' }
  if (claim.approvedAt) return { ok: false, error: 'This claim is already approved.' }
  if (claim.declinedAt) return { ok: false, error: 'This claim was declined. Ask them to claim the page again if that was a mistake.' }
  if (isEmployerSectionKey(claim.section)) return approveEmployerSection(claim, claim.section, adminEmail)
  const type = freeWorkspaceType(claim.crmOrganization.orgTypes.map(String))
  if (!type) return { ok: false, error: 'This kind of organization has no free workspace, so there is nothing to approve.' }
  const r = await provisionFreeWorkspace({ crmOrganizationId: claim.crmOrganizationId, name: claim.crmOrganization.name, orgType: type, claimantEmail: claim.email })
  if (!r.ok) return { ok: false, error: r.error }
  await prisma.orgClaim.update({ where: { id: claim.id }, data: { approvedAt: new Date(), approvedBy: adminEmail } })
  const connected = await connectRelated({ crmOrgId: claim.crmOrganizationId, institutionId: r.institutionId, referredByPartnerId: claim.referredByPartnerId })
  captureServerEvent(`org-claim:${claim.crmOrganizationId}`, 'org_claim_approved', { orgId: claim.crmOrganizationId, claimId: claim.id, orgType: type, institutionId: r.institutionId, workspaceCreated: r.created, relatedConnected: connected, referredByPartnerId: claim.referredByPartnerId })
  return { ok: true, slug: r.slug }
}

type OpenClaim = NonNullable<Awaited<ReturnType<typeof loadOpen>>>

// An employer's section claim (owner decision 2026-11-17: employers also get a free portal once approved).
//  - A claim held for review first runs the section claim as a confirmed one, so the claimant becomes the section's admin
//    (or, if someone already holds it, their admins are asked and nothing is granted).
//  - Hiring is the free portal: the PENDING workspace gets the claimant's email and they are emailed how to open it;
//    claimHiringWorkspace activates it when they sign up or open the Hiring portal with that email.
//  - Employees and Outplacement are sales-led (they need a contract): approval records it and the team follows up.
async function approveEmployerSection(claim: OpenClaim, section: EmployerSectionKey, adminEmail: string): Promise<DecisionResult> {
  let outcome = claim.outcome
  if (outcome === 'REVIEW') {
    const r = await applySectionClaim({
      id: claim.id, crmOrganizationId: claim.crmOrganizationId, orgName: claim.crmOrganization.name, orgTypes: claim.crmOrganization.orgTypes.map(String),
      orgDomain: cleanDomain(claim.crmOrganization.emailDomain), section, name: claim.name, title: claim.title, email: claim.email, emailDomain: claim.emailDomain, needsReview: false,
    })
    outcome = r.outcome.toUpperCase()
    if (r.outcome !== 'admin') {
      await prisma.orgClaim.update({ where: { id: claim.id }, data: { approvedAt: new Date(), approvedBy: adminEmail } })
      return { ok: false, error: r.outcome === 'requested' ? `${employerSection(section).label} at ${claim.crmOrganization.name} already has an administrator. We asked them about this person; nothing was granted.` : 'This organization is not set up as an employer, so there is no section to open.' }
    }
  }
  if (section === 'hiring') {
    const ws = await prisma.orgWorkspace.findFirst({
      where: { type: 'HIRING', org: { crmOrganizationId: claim.crmOrganizationId }, admins: { some: { email: { equals: claim.email, mode: 'insensitive' } } } },
      select: { id: true, status: true, refId: true, inviteEmail: true },
    })
    if (!ws) return { ok: false, error: 'The hiring workspace for this claim was not found. Ask them to claim the page again.' }
    if (ws.status === 'PENDING' && !ws.refId) await prisma.orgWorkspace.update({ where: { id: ws.id }, data: { inviteEmail: claim.email.toLowerCase(), plan: 'FREE' } })
    await sendHiringClaimApprovedEmail({
      to: claim.email, name: claim.name, orgName: claim.crmOrganization.name,
      signupUrl: `${urlForAppPath('/talent/signup')}?email=${encodeURIComponent(claim.email)}`, loginUrl: urlForAppPath('/talent/login'),
    })
  }
  await prisma.orgClaim.update({ where: { id: claim.id }, data: { approvedAt: new Date(), approvedBy: adminEmail } })
  const connected = await connectRelated({ crmOrgId: claim.crmOrganizationId, institutionId: null, referredByPartnerId: claim.referredByPartnerId })
  captureServerEvent(`org-claim:${claim.crmOrganizationId}`, 'org_claim_approved', { orgId: claim.crmOrganizationId, claimId: claim.id, orgType: 'EMPLOYER', section, outcome, relatedConnected: connected, referredByPartnerId: claim.referredByPartnerId })
  return { ok: true }
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
