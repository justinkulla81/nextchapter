'use server'

import { revalidatePath } from 'next/cache'
import { requireOutplacementRoleForAction } from '@/lib/employer/outplacement-auth'
import { inviteOrgUser, removeOrgUser } from '@/lib/employer/outplacement-org-users'
import { prisma } from '@/lib/prisma'
import type { OutplacementRole } from '@prisma/client'
import { recordPartnerAudit } from '@/lib/partners/audit'

export type InviteOrgUserState = { error?: string; sent?: boolean } | undefined

export async function inviteOrgUserAction(
  _prevState: InviteOrgUserState,
  formData: FormData
): Promise<InviteOrgUserState> {
  const orgUser = await requireOutplacementRoleForAction(['ADMIN'])
  if (!orgUser) return { error: 'You need Admin access on this account to invite teammates.' }

  const email = (formData.get('email') as string | null) ?? ''
  const fullName = (formData.get('fullName') as string | null)?.trim() || null
  const role = formData.get('role') as OutplacementRole | null
  if (!role) return { error: 'Choose a role.' }

  const result = await inviteOrgUser(orgUser, email, role, fullName)
  if (result.error) return result
  await recordPartnerAudit({ portal: 'OUTPLACEMENT', refId: orgUser.orgId, actorUserId: orgUser.userId, actorLabel: orgUser.email, action: 'team.invited', detail: { role } })

  revalidatePath('/employer/team')
  return { sent: true }
}

export async function removeOrgUserAction(id: string): Promise<{ error?: string; message?: string }> {
  const orgUser = await requireOutplacementRoleForAction(['ADMIN'])
  if (!orgUser) return { error: 'You need Admin access on this account to remove teammates.' }
  const r = await removeOrgUser(orgUser, id)
  if (r.error) return r
  await recordPartnerAudit({ portal: 'OUTPLACEMENT', refId: orgUser.orgId, actorUserId: orgUser.userId, actorLabel: orgUser.email, action: 'team.removed', targetType: 'OutplacementOrgUser', targetId: id })
  revalidatePath('/employer/team')
  return { message: 'Removed. They lose access right away.' }
}

export async function resendOrgInviteAction(id: string): Promise<{ error?: string; message?: string }> {
  const orgUser = await requireOutplacementRoleForAction(['ADMIN'])
  if (!orgUser) return { error: 'You need Admin access on this account to resend invites.' }
  const row = await prisma.outplacementOrgUser.findFirst({ where: { id, orgId: orgUser.orgId, acceptedAt: null }, select: { invitedEmail: true, role: true, fullName: true } })
  if (!row) return { error: 'They’ve already accepted, or the invite was removed.' }
  const r = await inviteOrgUser(orgUser, row.invitedEmail, row.role, row.fullName)
  if (r.error) return r
  return { message: 'Invite sent again.' }
}
