import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { uniqueSlug } from '@/lib/organizations/slug'
import { employerSection, type EmployerSection, type EmployerSectionKey } from '@/lib/employer/sections'
import { sendSectionClaimRequestEmail } from '@/lib/email/send-org-claim-email'

// What a verified claim does for ONE employer section (docs/specs/employer-sections-build-plan.md, section 5; owner
// decisions 2026-10-25). It runs from onClaimVerified, in addition to the CRM lead that hook already creates.
//
//  - First verified claimant of an UNCLAIMED section becomes its ADMIN (OrgWorkspaceAdmin, source DOMAIN_CLAIM).
//  - Any later claimant never becomes admin by domain alone: their request goes to the section's existing admins and to
//    the team, and nothing is granted.
//  - A claim with no known organization domain (needsReview) creates nothing; the team reviews it first.
//  - Outplacement and Employees are sales-led: the claim creates the workspace record (PENDING) and the team's lead. It
//    never creates seats, contracts or a login, and a PENDING workspace gives its admin no access until the team activates it.
//  - Hiring: the workspace stays PENDING with the claimant's email as inviteEmail. When that person signs up at
//    /talent/signup with that email, claimHiringWorkspace (unchanged) activates it.
//
// Nothing here changes any sign-in. It never throws to the caller's claim: onClaimVerified wraps it.

export type SectionClaimOutcome = 'admin' | 'requested' | 'review' | 'skipped'

export interface SectionClaimInput {
  id: string
  crmOrganizationId: string
  orgName: string
  orgTypes: string[]
  /** The organization's known email domain from the CRM, if any (already cleaned). */
  orgDomain: string | null
  section: EmployerSectionKey
  name: string
  title: string
  email: string
  emailDomain: string
  needsReview: boolean
}

export interface SectionClaimResult {
  outcome: SectionClaimOutcome
  section: EmployerSectionKey
}

const WORKSPACE_STATUS_FOR_NEW = 'PENDING'

async function ensureOrganization(input: SectionClaimInput): Promise<{ id: string } | null> {
  const found = await prisma.organization.findUnique({ where: { crmOrganizationId: input.crmOrganizationId }, select: { id: true } })
  if (found) return found
  const taken = new Set((await prisma.organization.findMany({ select: { slug: true } })).map((o) => o.slug))
  try {
    return await prisma.organization.create({
      data: { name: input.orgName, slug: uniqueSlug(input.orgName, (s) => taken.has(s) || s.length < 3), domain: input.orgDomain ?? input.emailDomain, crmOrganizationId: input.crmOrganizationId },
      select: { id: true },
    })
  } catch {
    // A second claim for the same record won the race (crmOrganizationId is unique): use its organization.
    return prisma.organization.findUnique({ where: { crmOrganizationId: input.crmOrganizationId }, select: { id: true } })
  }
}

export async function applySectionClaim(input: SectionClaimInput): Promise<SectionClaimResult> {
  const { section } = input
  const info: EmployerSection = employerSection(section)
  const props = { orgId: input.crmOrganizationId, section, claimId: input.id, emailDomain: input.emailDomain }
  const distinctId = `org-claim:${input.crmOrganizationId}`
  const result = async (outcome: SectionClaimOutcome): Promise<SectionClaimResult> => {
    // Recorded on the claim for the team's audit. Fail soft: the column may not be applied yet.
    try {
      await prisma.orgClaim.updateMany({ where: { id: input.id }, data: { outcome: outcome.toUpperCase() } })
    } catch {
      /* column not applied yet */
    }
    return { outcome, section }
  }

  if (!input.orgTypes.includes('EMPLOYER')) return { outcome: 'skipped', section }
  if (input.needsReview) {
    captureServerEvent(distinctId, 'employer_section_claim_verified', { ...props, outcome: 'review' })
    return result('review')
  }

  const org = await ensureOrganization(input)
  if (!org) return { outcome: 'skipped', section }
  const type = info.workspaceType
  const email = input.email.trim().toLowerCase()

  let workspace = await prisma.orgWorkspace.findUnique({
    where: { orgId_type: { orgId: org.id, type } },
    select: { id: true, refId: true, inviteEmail: true, status: true, admins: { select: { email: true, role: true } } },
  })
  if (!workspace) {
    try {
      workspace = await prisma.orgWorkspace.create({
        data: { orgId: org.id, type, status: WORKSPACE_STATUS_FOR_NEW, ...(section === 'hiring' ? { inviteEmail: email } : {}) },
        select: { id: true, refId: true, inviteEmail: true, status: true, admins: { select: { email: true, role: true } } },
      })
    } catch {
      workspace = await prisma.orgWorkspace.findUnique({
        where: { orgId_type: { orgId: org.id, type } },
        select: { id: true, refId: true, inviteEmail: true, status: true, admins: { select: { email: true, role: true } } },
      })
    }
  }
  if (!workspace) return { outcome: 'skipped', section }

  const admins = workspace.admins
  const alreadyAdmin = admins.some((a) => a.email.toLowerCase() === email)
  // Claimed already: someone holds it (an admin row), is linked to it (a portal record), or was invited to it.
  const claimedByOthers = admins.length > 0 || !!workspace.refId || !!workspace.inviteEmail
  const mine = alreadyAdmin || workspace.inviteEmail?.toLowerCase() === email

  if (!claimedByOthers || mine) {
    if (!alreadyAdmin) {
      try {
        await prisma.orgWorkspaceAdmin.create({ data: { workspaceId: workspace.id, email, role: 'ADMIN', source: 'DOMAIN_CLAIM', invitedBy: null } })
      } catch {
        /* a repeat of the same claim won the race: the row exists */
      }
    }
    if (section === 'hiring' && !workspace.inviteEmail && workspace.status === 'PENDING') {
      await prisma.orgWorkspace.update({ where: { id: workspace.id }, data: { inviteEmail: email } })
    }
    captureServerEvent(distinctId, 'employer_section_claim_verified', { ...props, outcome: 'admin' })
    return result('admin')
  }

  // A later claimant: never admin by domain alone. The existing admins decide, and the team is told.
  const to = [...new Set(admins.filter((a) => a.role === 'ADMIN').map((a) => a.email.toLowerCase()))].filter((e) => e !== email)
  let notified = 0
  if (to.length) {
    for (const admin of to) {
      if (await sendSectionClaimRequestEmail({ to: admin, orgName: input.orgName, sectionLabel: info.label, name: input.name, title: input.title, email })) notified++
    }
  }
  captureServerEvent(distinctId, 'employer_section_claim_blocked_existing_admin', { ...props, adminsNotified: notified })
  return result('requested')
}
