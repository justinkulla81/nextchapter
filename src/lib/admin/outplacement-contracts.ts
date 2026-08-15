import 'server-only'
import { prisma } from '@/lib/prisma'
import { createPreConfirmedInviteUser } from '@/lib/invite/invite-and-preconfirm'
import { sendOutplacementOrgInviteEmail } from '@/lib/email/send-outplacement-emails'
import { ORG_ROLE_LABEL } from '@/lib/employer/outplacement-org-role-labels'
import { captureServerEvent } from '@/lib/posthog/server'
import type { OutplacementTier } from '@prisma/client'

// Admin-side "Employer contracts" (§A9) — the provisioning side of the
// employer portal (§A7). Outplacement is a contract-sold product (no
// self-serve employer signup — see src/app/employer/signup), so an
// OutplacementEmployerOrg/OutplacementContract has to exist, and a first
// employer_admin invited, before any employer can log in at all. This is
// the minimal real version of §A9's fuller "seats, term, tier, discount,
// PO, renewal date, utilization, renewal risk" — discount/renewal-risk
// analytics are noted as a thinner/later pass in this phase's report, not
// fabricated here.

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export interface OrgWithContracts {
  id: string
  name: string
  programBrandName: string | null
  primaryContactEmail: string
  isSampleData: boolean
  contracts: {
    id: string
    cohortLabel: string | null
    tier: OutplacementTier
    seatCount: number
    usedSeats: number
    termStartAt: Date
    termEndAt: Date
    status: string
  }[]
}

export async function listOutplacementOrgs(): Promise<OrgWithContracts[]> {
  const orgs = await prisma.outplacementEmployerOrg.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      contracts: {
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { seats: { where: { status: { not: 'DEACTIVATED' } } } } } },
      },
    },
  })
  return orgs.map((org) => ({
    id: org.id,
    name: org.name,
    programBrandName: org.programBrandName,
    primaryContactEmail: org.primaryContactEmail,
    isSampleData: org.isSampleData,
    contracts: org.contracts.map((c) => ({
      id: c.id,
      cohortLabel: c.cohortLabel,
      tier: c.tier,
      seatCount: c.seatCount,
      usedSeats: c._count.seats,
      termStartAt: c.termStartAt,
      termEndAt: c.termEndAt,
      status: c.status,
    })),
  }))
}

export async function createOutplacementOrg(input: {
  name: string
  programBrandName: string | null
  primaryContactName: string | null
  primaryContactEmail: string
  isSampleData: boolean
}): Promise<{ id: string }> {
  const org = await prisma.outplacementEmployerOrg.create({ data: input })
  return { id: org.id }
}

export async function createOutplacementContract(
  adminUserId: string,
  input: {
    orgId: string
    cohortLabel: string | null
    tier: OutplacementTier
    seatCount: number
    termStartAt: Date
    termEndAt: Date
    poReference: string | null
    invoiceReference: string | null
    isSampleData: boolean
  }
): Promise<{ id: string }> {
  const contract = await prisma.outplacementContract.create({
    data: { ...input, createdBy: adminUserId },
  })
  captureServerEvent(adminUserId, 'outplacement_contract_created', {
    orgId: input.orgId,
    contractId: contract.id,
    tier: input.tier,
    seatCount: input.seatCount,
  })
  return { id: contract.id }
}

// Invites the org's first employer_admin — the only way into an org that
// has no accepted OutplacementOrgUser yet (later invites happen from
// inside the portal itself, see outplacement-org-users.ts's
// inviteOrgUser, employer_admin only).
export async function inviteFirstOrgAdmin(
  adminUserId: string,
  orgId: string,
  email: string,
  fullName: string | null
): Promise<{ error?: string }> {
  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail || !cleanEmail.includes('@')) return { error: 'Enter a valid email address.' }

  const org = await prisma.outplacementEmployerOrg.findUnique({ where: { id: orgId } })
  if (!org) return { error: 'Organization not found.' }

  const existing = await prisma.outplacementOrgUser.findUnique({
    where: { orgId_invitedEmail: { orgId, invitedEmail: cleanEmail } },
  })
  if (existing?.acceptedAt) return { error: 'This person already has access to this account.' }

  const orgUserRow =
    existing ??
    (await prisma.outplacementOrgUser.create({
      data: { orgId, invitedEmail: cleanEmail, fullName, role: 'ADMIN' },
    }))

  const { actionLink, error } = await createPreConfirmedInviteUser(
    cleanEmail,
    `${appUrl()}/auth/callback?next=outplacement-org-invite&inviteToken=${orgUserRow.inviteToken}`,
    { isFirstSend: !existing }
  )
  if (error || !actionLink) {
    if (!existing) await prisma.outplacementOrgUser.delete({ where: { id: orgUserRow.id } })
    return { error: error ?? 'Something went wrong sending the invite.' }
  }

  await sendOutplacementOrgInviteEmail(cleanEmail, org.name, ORG_ROLE_LABEL.ADMIN, actionLink)

  captureServerEvent(adminUserId, 'outplacement_org_admin_invited', { orgId })

  return {}
}
