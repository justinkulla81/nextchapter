import 'server-only'
import type { InstitutionOrgType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { uniqueSlug } from '@/lib/organizations/slug'
import { isReservedSlug } from '@/lib/organizations/front-door'
import { inviteInstitutionUser } from '@/lib/institution/invite'
import { captureServerEvent } from '@/lib/posthog/server'
import { FREE_MEMBER_CAP } from './entitlements'

// Creates the free workspace for a verified claim (the claim flow calls this;
// nothing else does). One Institution per CrmOrganization, so it is idempotent:
// calling it again for the same crmOrganizationId returns the same workspace
// and only makes sure the claimant still has an administrator seat.
//
// Why not createOrganization / createInstitution: createOrganization is the
// NextChapter admin's tool (it makes the umbrella Organization, may seed demo
// data and takes an admin email), and createInstitution resolves or creates a
// UNIVERSITY CRM record from the name, but a claim already has its CRM record.
// So this writes the Institution directly with the given crmOrganizationId and
// reuses inviteInstitutionUser for the administrator seat, which needs no admin
// context (it creates the staff row, a pre-confirmed login link and the email).

export type ProvisionInput = {
  crmOrganizationId: string
  name: string
  // An InstitutionOrgType, or a CRM organization type (CrmOrgType) to map.
  orgType: string
  claimantEmail: string
}

export type ProvisionResult = { ok: true; institutionId: string; slug: string; created: boolean } | { ok: false; error: string }

// COLLEGE = higher education; every other type is a workforce organization.
const INSTITUTION_TYPES: InstitutionOrgType[] = ['COLLEGE', 'WORKFORCE_BOARD', 'ECONOMIC_DEVELOPMENT', 'CHAMBER', 'COMMUNITY_ORG']
const CRM_TO_INSTITUTION: Record<string, InstitutionOrgType> = {
  UNIVERSITY: 'COLLEGE',
  GOVERNMENT: 'WORKFORCE_BOARD',
  WORKFORCE_PROVIDER: 'COMMUNITY_ORG',
  NONPROFIT: 'COMMUNITY_ORG',
  FOUNDATION: 'COMMUNITY_ORG',
}

export function institutionOrgTypeFor(type: string): InstitutionOrgType {
  const t = type.trim().toUpperCase()
  if ((INSTITUTION_TYPES as string[]).includes(t)) return t as InstitutionOrgType
  return CRM_TO_INSTITUTION[t] ?? 'COMMUNITY_ORG'
}

export async function provisionFreeWorkspace(input: ProvisionInput): Promise<ProvisionResult> {
  const { crmOrganizationId } = input
  const name = input.name.trim()
  const email = input.claimantEmail.trim().toLowerCase()
  if (!crmOrganizationId) return { ok: false, error: 'This claim has no organization record. Start the claim again.' }
  if (!name) return { ok: false, error: 'The organization needs a name.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address for the person claiming it.' }

  const existing = await prisma.institution.findUnique({ where: { crmOrganizationId }, select: { id: true, slug: true } })
  let institution = existing
  let created = false
  if (!institution) {
    const taken = new Set((await prisma.institution.findMany({ select: { slug: true } })).map((i) => i.slug))
    const slug = uniqueSlug(name, (s) => taken.has(s) || isReservedSlug(s) || s.length < 3)
    try {
      institution = await prisma.institution.create({
        data: { name, slug, orgType: institutionOrgTypeFor(input.orgType), tier: 'CAREER', plan: 'FREE', includedSeats: FREE_MEMBER_CAP, crmOrganizationId },
        select: { id: true, slug: true },
      })
      created = true
    } catch (e) {
      // A second claim for the same record won the race (crmOrganizationId is unique): use its workspace.
      institution = await prisma.institution.findUnique({ where: { crmOrganizationId }, select: { id: true, slug: true } })
      if (!institution) {
        console.error('provisionFreeWorkspace failed:', e)
        return { ok: false, error: 'We could not set up the workspace. Try again, and contact support if it keeps happening.' }
      }
    }
  }

  // The claimant is the administrator. Skip when they already hold the seat, so a repeat call sends no second email.
  const seat = await prisma.institutionUser.findFirst({ where: { institutionId: institution.id, invitedEmail: email, role: 'INSTITUTION_ADMIN', revokedAt: null }, select: { id: true } })
  if (!seat) {
    const r = await inviteInstitutionUser({ institutionSlug: institution.slug, email, role: 'INSTITUTION_ADMIN' })
    if (r.error) return { ok: false, error: r.error }
  }

  if (created) captureServerEvent(email, 'free_workspace_provisioned', { institutionId: institution.id, slug: institution.slug, crmOrganizationId, orgType: institutionOrgTypeFor(input.orgType) })
  return { ok: true, institutionId: institution.id, slug: institution.slug, created }
}
