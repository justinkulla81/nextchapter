import 'server-only'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createPreConfirmedInviteUser } from '@/lib/invite/invite-and-preconfirm'
import { sendOutplacementOrgInviteEmail } from '@/lib/email/send-outplacement-emails'
import { grantRoleIfMissing } from '@/lib/auth/role-grants'
import { captureServerEvent } from '@/lib/posthog/server'
import type { OutplacementRole, RoleGrantRole } from '@prisma/client'
import type { CurrentOutplacementOrgUser } from '@/lib/employer/outplacement-auth'
import { ORG_ROLE_LABEL } from '@/lib/employer/outplacement-org-role-labels'

export { ORG_ROLE_LABEL }

// Team management for the employer portal — employer_admin only (§A7:
// "employer_admin (enroll, billing, all reporting)"; inviting teammates is
// part of running the account, which only admin does). Distinct from
// enrollment (outplacement-enrollment.ts), which links a departing
// EMPLOYEE to a seat — this links an HR TEAM MEMBER to the portal itself.

// Mirrors OutplacementRole 1:1 into the global RoleGrant ledger's
// employer_* values — kept as an explicit map rather than a shared enum
// because the two serve different purposes (see OutplacementOrgUser's own
// schema comment) and should stay free to diverge.
const ORG_ROLE_TO_GRANT: Record<OutplacementRole, RoleGrantRole> = {
  ADMIN: 'employer_admin',
  VIEWER: 'employer_viewer',
  LEGAL: 'employer_legal',
  FINANCE: 'employer_finance',
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export interface OrgUserRow {
  id: string
  invitedEmail: string
  fullName: string | null
  role: OutplacementRole
  acceptedAt: Date | null
  invitedAt: Date
}

export async function listOrgUsers(orgUser: CurrentOutplacementOrgUser): Promise<OrgUserRow[]> {
  const rows = await prisma.outplacementOrgUser.findMany({
    where: { orgId: orgUser.orgId },
    select: { id: true, invitedEmail: true, fullName: true, role: true, acceptedAt: true, invitedAt: true },
    orderBy: { invitedAt: 'asc' },
  })
  return rows
}

export async function inviteOrgUser(
  orgUser: CurrentOutplacementOrgUser,
  email: string,
  role: OutplacementRole,
  fullName: string | null
): Promise<{ error?: string }> {
  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail || !cleanEmail.includes('@')) return { error: 'Enter a valid email address.' }

  const existing = await prisma.outplacementOrgUser.findUnique({
    where: { orgId_invitedEmail: { orgId: orgUser.orgId, invitedEmail: cleanEmail } },
  })
  if (existing?.acceptedAt) return { error: 'This person already has access to this account.' }

  const orgUserRow =
    existing ??
    (await prisma.outplacementOrgUser.create({
      data: { orgId: orgUser.orgId, invitedEmail: cleanEmail, fullName, role },
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

  const org = await prisma.outplacementEmployerOrg.findUnique({ where: { id: orgUser.orgId }, select: { name: true } })
  await sendOutplacementOrgInviteEmail(cleanEmail, org?.name ?? 'your organization', ORG_ROLE_LABEL[role], actionLink)

  captureServerEvent(orgUser.userId, 'outplacement_org_user_invited', { orgId: orgUser.orgId, role })

  return {}
}

// Called from CallbackHandler once an admin-generated magic link has
// established a session — same shape as finishAcceptingCoachInvite/
// finishAcceptingOutplacementSeat. Also stamps the global RoleGrant ledger
// (so RoleContextBanner picks this identity up if they also hold another
// role elsewhere in the product) — the OutplacementOrgUser row itself is
// what actually authorizes portal access; RoleGrant is presentation only.
export async function finishAcceptingOutplacementOrgInvite(inviteToken: string): Promise<{ error?: string }> {
  const supabase = await createClient('employer')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email) return { error: 'You need to be logged in to accept this invite.' }

  const invite = await prisma.outplacementOrgUser.findUnique({ where: { inviteToken } })
  if (!invite) return { error: 'This invite link is not valid.' }
  if (invite.acceptedAt) return { error: 'This invite has already been accepted.' }
  if (user.email.toLowerCase() !== invite.invitedEmail.toLowerCase()) {
    return { error: `This invite was sent to ${invite.invitedEmail}. Log in with that email to accept it.` }
  }

  await prisma.outplacementOrgUser.update({
    where: { id: invite.id },
    data: { userId: user.id, acceptedAt: new Date() },
  })
  await grantRoleIfMissing(user.id, ORG_ROLE_TO_GRANT[invite.role])

  captureServerEvent(user.id, 'outplacement_org_invite_accepted', { orgId: invite.orgId, role: invite.role })

  return {}
}
